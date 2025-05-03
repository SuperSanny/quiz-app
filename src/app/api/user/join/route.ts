
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import QuizState from '@/models/QuizState';
import { IAttempt } from '@/models/Attempt';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  let quizSessionId: string | null = null; // Initialize quizSessionId
  console.log('--- Anonymous User Join Request Received ---');
  try {

    // No need to parse name from body anymore

    // 1. Database Connection
    try {
        await dbConnect();
        console.log(`Anonymous Join: DB connected.`);
    } catch (dbError) {
        console.error(`Anonymous Join: DB connection error:`, dbError);
        return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
    }

    // 2. Find the *current* active quiz session
    let currentQuizState;
    try {
        console.log(`Anonymous Join: Searching for active quiz session...`);
        currentQuizState = await QuizState.findOne({ isQuizActive: true }).sort({ createdAt: -1 });
    } catch (findStateError) {
        console.error(`Anonymous Join: Error finding active quiz state:`, findStateError);
        return NextResponse.json({ message: 'Internal Server Error: Could not retrieve quiz status' }, { status: 500 });
    }

    if (!currentQuizState) {
      console.log(`Anonymous Join: No active quiz session found. Informing user.`);
      return NextResponse.json({ message: 'No active quiz found. Please wait for the admin to start.' }, { status: 404 });
    }

    quizSessionId = currentQuizState.quizSessionId;
    console.log(`Anonymous Join: Found active session ${quizSessionId}. Creating new anonymous user attempt.`);

    // 3. Create a *new* anonymous User Attempt for this specific session
    let newUserAttempt: IAttempt | null = null;
    try {
        console.log(`Anonymous Join [Session: ${quizSessionId}]: Creating new Attempt document...`);
        const now = new Date();
        newUserAttempt = new Attempt({
            // userName is removed
            quizSessionId: quizSessionId,
            answers: [],
            score: 0,
            // feedback is removed
            joinedAt: now,
            lastActivity: now
        });

        await newUserAttempt.save(); // Save the new document

        if (!newUserAttempt) {
            console.error(`Anonymous Join [Session: ${quizSessionId}]: CRITICAL - Failed to save new anonymous user attempt.`);
            return NextResponse.json({ message: 'Internal Server Error: Failed to register user.' }, { status: 500 });
        }

        console.log(`Anonymous Join [Session: ${quizSessionId}]: Anonymous user created with ID: ${newUserAttempt._id}.`);

        // 4. Return user details (only userId and session ID)
        return NextResponse.json({
            userId: newUserAttempt._id.toString(), // Convert ObjectId to string
            quizSessionId: newUserAttempt.quizSessionId,
        }, { status: 201 }); // 201 Created

    } catch (error) {
         console.error(`Anonymous Join [Session: ${quizSessionId}]: Error during Attempt creation/save:`, error);
         if (error instanceof mongoose.Error.ValidationError) {
            console.error(`Anonymous Join [Session: ${quizSessionId}]: Validation Error:`, error.message);
            return NextResponse.json({ message: `Validation Error: ${error.message}` }, { status: 400 });
         }
         return NextResponse.json({ message: 'Internal Server Error during registration.' }, { status: 500 });
    } finally {
        console.log('--- Anonymous User Join Request Finished ---');
    }

  } catch (error) {
    // Handle errors in request processing (e.g., DB connection issues before finding session)
    console.error(`Anonymous Join [Session: ${quizSessionId || 'unknown'}]: Top-level error processing join request:`, error);
    // No JSON parsing error expected here anymore
    return NextResponse.json({ message: 'Internal Server Error processing request' }, { status: 500 });
  }
}
