
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState, { IQuizState } from '@/models/QuizState';
import Attempt from '@/models/Attempt'; // Import Attempt to potentially clear old data if needed
import { getRandomQuestions } from '@/lib/questions';
import { v4 as uuidv4 } from 'uuid'; // For generating unique session IDs
import mongoose from 'mongoose'; // Import mongoose

// --- Security ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.error("CRITICAL SECURITY WARNING: ADMIN_PASSWORD environment variable is not set on the server!");
}


export async function POST(request: Request) {
  console.log('--- Admin Start Quiz Request Received ---');
  try {
     // --- Authentication ---
     if (!ADMIN_PASSWORD) {
        console.error("Admin Start: Authentication skipped because ADMIN_PASSWORD is not set on the server.");
        return NextResponse.json({ message: 'Internal Server Error: Admin password not configured.' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Admin Start: Unauthorized - Missing or invalid Authorization header');
        return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    if (token !== ADMIN_PASSWORD) {
        console.warn('Admin Start: Unauthorized - Invalid password attempt');
        return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    console.log('Admin Start: Authentication successful.');

     // --- Parse Request Body for Bonus Question ---
     let bonusQuestionText = '';
     try {
         const body = await request.json();
         bonusQuestionText = body.bonusQuestionText?.trim() || ''; // Get bonus question text, default to empty
         console.log(`Admin Start: Received bonus question text: "${bonusQuestionText}"`);
     } catch (parseError) {
          console.warn('Admin Start: Could not parse request body or bonusQuestionText missing.');
          // Continue without bonus question if parsing fails or text is missing
     }


    console.log("Admin Start: Attempting database connection...");
    const mongoconnect = await dbConnect();
    console.log("Admin Start: Database connected.");


    // --- Deactivate any previous active quizzes ---
    console.log("Admin Start: Deactivating any existing active quiz sessions...");
    const updateResult = await QuizState.updateMany({ isQuizActive: true }, { $set: { isQuizActive: false } });
    console.log(`Admin Start: Deactivated ${updateResult.modifiedCount} previous quiz session(s).`);

    // --- Optional: Clear old attempts ---
    // Consider clearing attempts based on the *old* session ID if needed, or leave them for historical stats
    // console.log("Admin Start: Clearing previous attempts for OLD sessions (if any)...");
    // const oldActiveSession = await QuizState.findOne({ isQuizActive: true }).sort({ createdAt: -1 }); // Find just before deactivation
    // if(oldActiveSession) {
    //     await Attempt.deleteMany({ quizSessionId: oldActiveSession.quizSessionId });
    //     console.log(`Admin Start: Cleared attempts for previous session ${oldActiveSession.quizSessionId}`);
    // }


    // Generate a unique ID for this new quiz session
    const newQuizSessionId = uuidv4();
    console.log(`Admin Start: Generated new Quiz Session ID: ${newQuizSessionId}`);

    // Get 10 random questions
    console.log("Admin Start: Fetching random questions...");
    const selectedQuestions = getRandomQuestions(10); // Fetch 10 standard questions

    if (!selectedQuestions || selectedQuestions.length < 10) {
      console.error(`Admin Start: Failed to load sufficient standard questions. Loaded only ${selectedQuestions?.length || 0}.`);
      return NextResponse.json({ message: 'Failed to load sufficient standard questions' }, { status: 500 });
    }
    console.log(`Admin Start: Loaded ${selectedQuestions.length} standard questions.`);


    // Create a new quiz state document
    console.log("Admin Start: Creating new QuizState document in database...");
    const newQuizState = new QuizState({
      currentQuestionIndex: 0, // Start at the first question
      isQuizActive: true,
      activeQuizQuestions: selectedQuestions,
      bonusQuestionText: bonusQuestionText, // <<< SAVE THE BONUS QUESTION TEXT HERE
      quizSessionId: newQuizSessionId, // Assign the unique session ID
    });

    await newQuizState.save();
    console.log(`Admin Start: Successfully saved new QuizState document with ID: ${newQuizState._id}, Session: ${newQuizSessionId}. Bonus Included: ${!!bonusQuestionText}`);


    return NextResponse.json({
        message: 'Quiz started successfully',
        quizSessionId: newQuizSessionId,
        bonusQuestionIncluded: !!bonusQuestionText // Inform client if bonus was included
     }, { status: 200 });

  } catch (error) {
    console.error('Admin Start: Error starting quiz:', error);
    if (error instanceof mongoose.Error) {
         console.error('Admin Start: Mongoose specific error:', error.message);
         return NextResponse.json({ message: `Database Error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal Server Error starting quiz' }, { status: 500 });
  } finally {
     console.log('--- Admin Start Quiz Request Finished ---');
  }
}
