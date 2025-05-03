
import mongoose from 'mongoose';

// --- IMPORTANT FOR PRODUCTION ---
// Ensure these environment variables are correctly set in your deployment environment (e.g., Vercel, Netlify, Docker).
// They will NOT be automatically picked up from a local .env file in a production build.
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

console.log(MONGODB_URI, MONGODB_DB); // Log the environment variables for debugging (remove in production)

// --- Environment Variable Validation ---
if (!MONGODB_URI) {
  console.error('CRITICAL ERROR: MONGODB_URI environment variable is not defined.');
  // In production, this likely means the variable wasn't set in the deployment settings.
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env (for local development) or your deployment environment configuration (for production).'
  );
} else {
  // Log partially masked URI for verification (avoid logging the full password)
  try {
    const uriParts = MONGODB_URI.split('@');
    const protocolAndUser = uriParts[0].split('//');
    const user = protocolAndUser.length > 1 ? protocolAndUser[1].split(':')[0] : '[no user]';
    const hostPart = uriParts.length > 1 ? uriParts[1].split('/')[0] : '[unknown host]'; // Extract host part
    const maskedUri = uriParts.length > 1 ? `${protocolAndUser[0]}//${user}:<password>@${hostPart}` : MONGODB_URI;
    console.log(`Attempting to use MONGODB_URI (masked): ${maskedUri}`);
  } catch (e) {
    console.log('Attempting to use MONGODB_URI (unable to mask for logging).');
  }
}

if (!MONGODB_DB) {
  console.error('CRITICAL ERROR: MONGODB_DB environment variable is not defined.');
  // In production, this likely means the variable wasn't set in the deployment settings.
  throw new Error(
    'Please define the MONGODB_DB environment variable inside .env (for local development) or your deployment environment configuration (for production). This specifies the database to use.'
  );
} else {
  console.log(`Attempting to connect to database specified by MONGODB_DB: ${MONGODB_DB}`); // Log the database name being used
}


// --- Mongoose Cache Setup ---
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend the NodeJS Global type with the mongoose cache
declare global {
  var mongoose: MongooseCache;
}


// Initialize cache (handle potential hot-reloading in development)
let cached = global.mongoose;

if (!cached) {
  console.log('Initializing global mongoose cache.');
  cached = global.mongoose = { conn: null, promise: null };
}


// --- Database Connection Function ---
async function dbConnect(): Promise<typeof mongoose> {
  // Return cached connection if it exists and is ready
  if (cached.conn) {
    // Basic check if connection seems okay (readyState 1 means connected)
    if (cached.conn.connection.readyState === 1) {
      // console.log('Using cached MongoDB connection.'); // Less verbose logging
      return cached.conn;
    } else {
      console.warn(`Cached connection found but its readyState is ${cached.conn.connection.readyState}. Will attempt to reconnect.`);
      // Invalidate cache if connection is lost/closed/etc.
      cached.conn = null;
      cached.promise = null;
    }
  }

  // If no promise exists (or was reset), create a new connection promise
  if (!cached.promise) {
    console.log('Creating new MongoDB connection promise.');
    console.log(`Using MONGODB_URI from environment for connection: ${MONGODB_URI ? 'Loaded' : 'MISSING!'}`); // Explicitly log if URI is loaded
    console.log(`Using MONGODB_DB from environment: ${MONGODB_DB || 'MISSING!'}`); // Explicitly log DB name or if missing

    // Ensure environment variables are loaded before attempting connection
    if (!MONGODB_URI || !MONGODB_DB) {
      console.error("CRITICAL: MONGODB_URI or MONGODB_DB is missing at the time of connection attempt. Cannot connect.");
      throw new Error("Missing MongoDB connection details in environment.");
    }

    // Define connection options
    const opts: mongoose.ConnectOptions = {
      dbName: MONGODB_DB, // Specify the database name here
      bufferCommands: false, // Disable buffering for immediate errors
      serverSelectionTimeoutMS: 5000, // Shorter timeout for faster feedback
      socketTimeoutMS: 45000,
      // Consider adding options like autoIndex: false for production if indexes are managed separately
      // Consider specifying authSource if needed: authSource: 'admin',
    };

    // Log the connection options being used (excluding sensitive info if any were added)
    console.log('Mongoose connection options being used:', opts); // Log the options

    // Start the connection attempt using MONGODB_URI and options
    console.log(`Attempting mongoose.connect with URI ending in ...${MONGODB_URI.slice(-20)} and DB: ${MONGODB_DB}`); // Log connection attempt details
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      // Log successful connection details
      const connection = mongooseInstance.connection;
      console.log(`MongoDB connection promise resolved successfully. Connected to DB: ${connection.db.databaseName} on host: ${connection.host}:${connection.port}`);

      // Add listeners for connection events (optional but good practice)
      connection.on('error', (err) => {
        console.error('Mongoose connection error after initial connection:', err);
        // Invalidate cache on persistent errors
        cached.conn = null;
        cached.promise = null;
      });
      connection.on('disconnected', () => {
        console.warn('Mongoose connection disconnected.');
        // Invalidate cache on disconnection
        cached.conn = null;
        cached.promise = null;
      });
      connection.on('reconnected', () => {
        console.log('Mongoose connection reconnected.');
      });
      return mongooseInstance;
    }).catch(err => {
      // Log detailed error and reset the promise to allow retries
      console.error('!!! MongoDB connection promise FAILED during initial connection attempt !!!');
      console.error(`Error Message: ${err.message}`);
      console.error('--- Troubleshooting Tips ---');
      console.error('* Verify MONGODB_URI is correct (including protocol, credentials, host, port).');
      console.error('* Verify MONGODB_DB is the correct database name.');
      console.error('* Check network access: Can your application server reach the database server IP/hostname?');
      console.error('* Check IP Whitelisting (e.g., in MongoDB Atlas Network Access settings).');
      console.error('* Verify database user credentials (username/password).');
      console.error('* Check the `authMechanism` in your URI (or remove it to let Mongoose negotiate).');
      console.error('* Check if the database server is running.');
      console.error('--- Error Details ---');
      console.error(err); // Log the full error object
      console.error('-----------------------');

      cached.promise = null; // Allow retry on next call
      throw err; // Re-throw the error to indicate failure
    });
  }

  // Await the connection promise (either the existing one or the newly created one)
  try {
    console.log('Awaiting MongoDB connection promise...');
    cached.conn = await cached.promise;
    // Double-check connection status after awaiting
    if (!cached.conn || cached.conn.connection.readyState !== 1) {
      const state = cached.conn?.connection.readyState ?? 'undefined';
      console.error(`MongoDB connection awaited but readyState is ${state}. Connection likely failed.`);
      cached.conn = null; // Invalidate connection if not ready
      cached.promise = null; // Invalidate promise
      throw new Error(`Failed to establish MongoDB connection - unexpected state (${state}) after await.`);
    }
    // Success logged in .then() now
    return cached.conn;
  } catch (error: any) {
    // Log error if awaiting the promise failed (this usually means the connect() promise rejected)
    console.error('Failed to establish MongoDB connection while awaiting promise. See initial connection error above.');
    // Ensure cache is reset on failure
    cached.conn = null;
    cached.promise = null;
    throw error; // Re-throw error to be handled by the caller
  }
}

export default dbConnect;
