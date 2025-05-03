
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import mongoose from 'mongoose';

// Basic password protection (ensure consistency with /start and /next)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

export async function POST(request: Request) {
   // 1. Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Admin End: Missing or invalid Authorization header');
        return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    if (token !== ADMIN_PASSWORD) {
        console.warn('Admin End: Invalid password attempt');
        return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // 2. Database Connection
    try {
        await dbConnect();
        console.log("Admin End: Database connected successfully.");
    } catch (error) {
        console.error('Admin End: Database connection failed:', error);
        return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
    }

    // 3. Find and Deactivate Logic
    try {
        // Find the most recent active quiz and set isQuizActive to false
        const endedQuizState = await QuizState.findOneAndUpdate(
            { isQuizActive: true }, // Filter: Find the active quiz
            { $set: { isQuizActive: false } }, // Update: Set active to false
            { new: true, sort: { createdAt: -1 } } // Options: Return the updated doc, sort by creation
        );

        if (!endedQuizState) {
            console.log('Admin End: No active quiz found to end.');
            // If no active quiz, it might already be ended or none started. Return success.
            return NextResponse.json({ message: 'No active quiz found or quiz already ended' }, { status: 200 });
        }

        console.log(`Admin End: Successfully ended quiz session ${endedQuizState.quizSessionId}.`);
        return NextResponse.json({ message: `Quiz session ${endedQuizState.quizSessionId} ended successfully`, quizSessionId: endedQuizState.quizSessionId }, { status: 200 });

    } catch (error) {
        console.error('Admin End: Error ending quiz session:', error);
         if (error instanceof mongoose.Error) {
            console.error('Admin End: Mongoose error details:', error.message);
            return NextResponse.json({ message: `Database Error: ${error.message}` }, { status: 500 });
        }
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

// Optional: Implement GET handler if needed, e.g., to confirm end status (though /api/quiz/state might suffice)
// export async function GET(request: Request) {
//   // ... implementation ...
// }
```