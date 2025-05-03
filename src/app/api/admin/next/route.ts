
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import mongoose from 'mongoose';

// Basic password protection (ensure consistency with /start and /end)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

export async function POST(request: Request) {
   // 1. Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Admin Next: Missing or invalid Authorization header');
        return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    if (token !== ADMIN_PASSWORD) {
        console.warn('Admin Next: Invalid password attempt');
        return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // 2. Database Connection
    try {
        await dbConnect();
        console.log("Admin Next: Database connected successfully.");
    } catch (error) {
        console.error('Admin Next: Database connection failed:', error);
        return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
    }

    // 3. Find and Update Logic (Atomic Update)
    try {
        // Find the most recent active quiz and increment its index atomically
        const updatedQuizState = await QuizState.findOneAndUpdate(
            { isQuizActive: true }, // Filter: Find the active quiz
            { $inc: { currentQuestionIndex: 1 } }, // Update: Increment the index
            { new: true, sort: { createdAt: -1 } } // Options: Return the updated doc, sort by creation if multiple active (shouldn't happen ideally)
        );

        if (!updatedQuizState) {
            console.log('Admin Next: No active quiz found to advance.');
            return NextResponse.json({ message: 'No active quiz found to advance' }, { status: 404 });
        }

        const newIndex = updatedQuizState.currentQuestionIndex;
        const totalQuestions = updatedQuizState.activeQuizQuestions.length; // Typically 10

        console.log(`Admin Next: Advanced quiz ${updatedQuizState.quizSessionId} to index ${newIndex}`);

        // Allow index to go up to totalQuestions (e.g., 10) for the feedback stage
        if (newIndex <= totalQuestions) {
            return NextResponse.json({ message: `Advanced to question index ${newIndex}`, newIndex: newIndex }, { status: 200 });
        } else {
            // If the index went beyond the feedback stage (e.g., 11), it means we tried to advance past the end.
            // This shouldn't happen if the UI disables correctly, but handle defensively.
            // We don't automatically deactivate the quiz here; let the /end endpoint handle that explicitly.
            console.warn(`Admin Next: Attempted to advance quiz ${updatedQuizState.quizSessionId} beyond feedback stage (Index: ${newIndex}).`);
             // Decrement back if we went too far (optional, depends on desired behavior)
             await QuizState.updateOne({ _id: updatedQuizState._id }, { $set: { currentQuestionIndex: totalQuestions } });
            return NextResponse.json({ message: 'Quiz is already at the feedback stage or finished', currentIdex: totalQuestions }, { status: 400 });
        }

    } catch (error) {
        console.error('Admin Next: Error advancing question:', error);
         if (error instanceof mongoose.Error) {
             console.error('Admin Next: Mongoose error details:', error.message);
            return NextResponse.json({ message: `Database Error: ${error.message}` }, { status: 500 });
        }
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
```