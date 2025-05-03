
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import mongoose from 'mongoose';

// --- Security ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.error("CRITICAL SECURITY WARNING: ADMIN_PASSWORD environment variable is not set on the server!");
}

const TOTAL_STANDARD_QUESTIONS = 10; // Define the number of standard questions

export async function POST(request: Request) {
    console.log('--- Admin Next Question Request Received ---');

    // 1. Authentication
    if (!ADMIN_PASSWORD) {
        console.error("Admin Next: Authentication skipped because ADMIN_PASSWORD is not set on the server.");
        return NextResponse.json({ message: 'Internal Server Error: Admin password not configured.' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Admin Next: Unauthorized - Missing or invalid Authorization header');
        return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    if (token !== ADMIN_PASSWORD) {
        console.warn('Admin Next: Unauthorized - Invalid password attempt');
        return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    // console.log('Admin Next: Authentication successful.');


    // 2. Database Connection
    try {
        await dbConnect();
        // console.log("Admin Next: Database connected successfully.");
    } catch (error) {
        console.error('Admin Next: Database connection failed:', error);
        console.error(error);
        return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
    }

    // 3. Find and Update Logic (Atomic Update)
    try {
        // console.log('Admin Next: Attempting to find and advance the active quiz session...');
        const updatedQuizState = await QuizState.findOneAndUpdate(
            { isQuizActive: true }, // Filter: Find the active quiz
            {
                $inc: { currentQuestionIndex: 1 }, // Update: Increment the index
                $set: { updatedAt: new Date() } // Explicitly update the timestamp
            },
            { new: true, sort: { createdAt: -1 } } // Options: Return updated doc
        );

        if (!updatedQuizState) {
            // console.log('Admin Next: No active quiz session found to advance.');
            return NextResponse.json({ message: 'No active quiz found or quiz has ended.' }, { status: 404 });
        }

        const newIndex = updatedQuizState.currentQuestionIndex;
        const bonusQuestionExists = !!updatedQuizState.bonusQuestionText; // Check if bonus question was set

        // console.log(`Admin Next: Advanced quiz ${updatedQuizState.quizSessionId} to index ${newIndex}. Bonus Question Exists: ${bonusQuestionExists}`);

        // Allow index to go up to TOTAL_STANDARD_QUESTIONS for the bonus stage
        if (newIndex <= TOTAL_STANDARD_QUESTIONS) {
            // If we are AT the bonus question index AND no bonus question text exists, skip it by ending the quiz
            if (newIndex === TOTAL_STANDARD_QUESTIONS && !bonusQuestionExists) {
                // console.log(`Admin Next: Reached bonus question index (${newIndex}) but no bonus question text found. Ending quiz automatically.`);
                updatedQuizState.isQuizActive = false;
                updatedQuizState.updatedAt = new Date();
                await updatedQuizState.save();
                // console.log(`Admin Next: Quiz ${updatedQuizState.quizSessionId} automatically ended.`);
                return NextResponse.json({ message: `Reached end of standard questions. No bonus question set. Quiz ended.`, newIndex: newIndex, quizEnded: true }, { status: 200 });
            }
            // Otherwise, it's a valid next step (either standard question or bonus question)
            const stageMessage = newIndex === TOTAL_STANDARD_QUESTIONS ? 'bonus question stage' : `question index ${newIndex}`;
            // console.log(`Admin Next: Successfully advanced to ${stageMessage}.`);
            return NextResponse.json({ message: `Advanced to ${stageMessage}`, newIndex: newIndex }, { status: 200 });

        } else {
            // If the index went beyond the bonus stage (e.g., 11 when TOTAL_STANDARD_QUESTIONS is 10)
            console.warn(`Admin Next: Attempted to advance quiz ${updatedQuizState.quizSessionId} beyond bonus stage (Index: ${newIndex}). Quiz should ideally be ended via 'End Quiz'.`);
            // Revert the index increment to stay at the bonus stage (or last valid stage)
            const revertToIndex = TOTAL_STANDARD_QUESTIONS; // Stay at bonus stage index
            try {
                await QuizState.updateOne({ _id: updatedQuizState._id }, { $set: { currentQuestionIndex: revertToIndex } });
                // console.log(`Admin Next: Reverted index for quiz ${updatedQuizState.quizSessionId} back to bonus stage (${revertToIndex}) due to over-advancement.`);
                return NextResponse.json({ message: 'Quiz is already at the bonus question stage. Cannot advance further.', newIndex: revertToIndex }, { status: 400 }); // 400 Bad Request
            } catch (revertError) {
                console.error(`Admin Next: Error reverting index for quiz ${updatedQuizState.quizSessionId}:`, revertError);
                return NextResponse.json({ message: 'Internal Server Error while handling over-advancement.' }, { status: 500 });
            }
        }

    } catch (error) {
        console.error('Admin Next: Error during findOneAndUpdate or subsequent logic:', error);
        console.error(error);
        if (error instanceof mongoose.Error) {
            console.error('Admin Next: Mongoose specific error:', error.message);
            return NextResponse.json({ message: `Database Error: ${error.message}` }, { status: 500 });
        }
        return NextResponse.json({ message: 'Internal Server Error while advancing quiz' }, { status: 500 });
    } finally {
        console.log('--- Admin Next Question Request Finished ---');
    }
}
