
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import mongoose from 'mongoose';

// --- Security ---
// Use the secure ADMIN_PASSWORD environment variable set on the server.
// DO NOT use NEXT_PUBLIC_ variables for secrets.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Verify ADMIN_PASSWORD is set during server startup (optional but recommended)
if (!ADMIN_PASSWORD) {
    console.error("CRITICAL SECURITY WARNING: ADMIN_PASSWORD environment variable is not set on the server!");
    // In a real production scenario, you might want to prevent the API route from functioning without a password.
    // throw new Error("Admin password not configured.");
}

export async function POST(request: Request) {
    console.log('--- Admin End Quiz Request Received ---');

    // 1. Authentication
    if (!ADMIN_PASSWORD) {
        console.error("Admin End: Authentication skipped because ADMIN_PASSWORD is not set on the server.");
        return NextResponse.json({ message: 'Internal Server Error: Admin password not configured.' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Admin End: Unauthorized - Missing or invalid Authorization header');
        return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    if (token !== ADMIN_PASSWORD) {
        console.warn('Admin End: Unauthorized - Invalid password attempt');
        return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    // console.log('Admin End: Authentication successful.');

    // 2. Database Connection
    try {
        await dbConnect(); // Ensure connection is awaited
        // console.log("Admin End: Database connected successfully.");
    } catch (error) {
        console.error('Admin End: Database connection failed:', error);
        return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
    }

    // 3. Find and Deactivate Logic
    try {
        // console.log('Admin End: Attempting to find and end the active quiz session...');
        // Find the most recent *active* quiz and set isQuizActive to false
        const endedQuizState = await QuizState.findOneAndUpdate(
            { isQuizActive: true }, // Filter: Find the *currently active* quiz
            { $set: { isQuizActive: false, updatedAt: new Date() } }, // Update: Set active to false and update timestamp
            { new: true, sort: { createdAt: -1 } } // Options: Return the updated doc, sort by creation date descending
        );

        if (!endedQuizState) {
            // console.log('Admin End: No active quiz session found to end. It might already be ended or none was started.');
            // If no active quiz, it's not an error, just nothing to do.
            return NextResponse.json({ message: 'No active quiz found or quiz already ended' }, { status: 200 });
        }

        // console.log(`Admin End: Successfully ended quiz session ${endedQuizState.quizSessionId}. isQuizActive is now ${endedQuizState.isQuizActive}.`);
        return NextResponse.json({ message: `Quiz session ${endedQuizState.quizSessionId} ended successfully`, quizSessionId: endedQuizState.quizSessionId }, { status: 200 });

    } catch (error) {
        console.error('Admin End: Error during findOneAndUpdate operation:', error);
        if (error instanceof mongoose.Error) {
            console.error('Admin End: Mongoose specific error:', error.message);
            return NextResponse.json({ message: `Database Error: ${error.message}` }, { status: 500 });
        }
        // Generic error for other cases
        return NextResponse.json({ message: 'Internal Server Error while ending quiz' }, { status: 500 });
    } finally {
        console.log('--- Admin End Quiz Request Finished ---');
    }
}

// Optional: Implement GET handler if needed, e.g., to confirm end status (though /api/quiz/state might suffice)
// export async function GET(request: Request) {
//   // ... implementation ...
// }
