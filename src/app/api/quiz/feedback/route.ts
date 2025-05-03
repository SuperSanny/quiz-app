
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import mongoose from 'mongoose';
import QuizState from '@/models/QuizState'; // Import QuizState

export async function POST(request: Request) {
   let userId: string | null = null;
   let quizSessionId: string | null = null;
   let feedback: string | undefined = undefined;
   let reqPayload: any = {};

  console.log('--- Feedback Submit Request Received ---');
  try {
    await dbConnect(); // Connect early
    console.log("Feedback Submit: DB connected.");

    reqPayload = await request.json();
    userId = reqPayload.userId;
    quizSessionId = reqPayload.quizSessionId;
    feedback = reqPayload.feedback;
    console.log(`Feedback Submit: Payload - User: ${userId}, Session: ${quizSessionId}, Feedback provided: ${feedback !== undefined}`);


    // Validate input
    if (!userId || !quizSessionId || feedback === undefined) {
        console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Validation Failed - Missing required fields.`);
      return NextResponse.json({ message: 'Missing required fields (userId, quizSessionId, feedback)' }, { status: 400 });
    }
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Validation Failed - Invalid user ID format.`);
       return NextResponse.json({ message: 'Invalid user ID format' }, { status: 400 });
    }
    if (typeof feedback !== 'string') {
        console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Validation Failed - Feedback is not a string.`);
       return NextResponse.json({ message: 'Feedback must be a string' }, { status: 400 });
    }
     const trimmedFeedback = feedback.trim();
     if (trimmedFeedback.length > 1000) { // Add length limit
         console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Validation Failed - Feedback exceeds 1000 characters.`);
         return NextResponse.json({ message: 'Feedback cannot exceed 1000 characters.' }, { status: 400 });
     }
     console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Input validation passed.`);


      // Optional: Verify the quiz session is actually in the feedback stage or finished
      console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Verifying quiz state...`);
       const quizState = await QuizState.findOne({ quizSessionId: quizSessionId });
       if (!quizState) {
           console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Quiz session not found.`);
           return NextResponse.json({ message: 'Quiz session not found.' }, { status: 404 });
       }
       console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Quiz state found. Active: ${quizState.isQuizActive}, Index: ${quizState.currentQuestionIndex}, Questions: ${quizState.activeQuizQuestions.length}`);

       // Define feedback stage index
       const feedbackStageIndex = quizState.activeQuizQuestions.length; // e.g., 10 if there are 10 questions (0-9)

       // Allow feedback if the quiz is at the feedback stage OR if the quiz is no longer active (finished)
       if (quizState.isQuizActive && quizState.currentQuestionIndex !== feedbackStageIndex) {
           console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Attempted to submit feedback before feedback stage (Current index: ${quizState.currentQuestionIndex}, Expected: ${feedbackStageIndex}).`);
           return NextResponse.json({ message: `Cannot submit feedback until the feedback stage (after question ${feedbackStageIndex}).` }, { status: 400 });
       }
        console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Quiz state check passed (either at feedback stage or finished).`);


    // Find the user's attempt document for the specific session
    console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Finding user attempt document...`);
    const userAttempt = await Attempt.findOne({ _id: userId, quizSessionId: quizSessionId });

    if (!userAttempt) {
       console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: User attempt document not found.`);
      return NextResponse.json({ message: 'User attempt not found for this session' }, { status: 404 });
    }
     console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: User attempt document found.`);


    // Update feedback and last activity
    console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Updating feedback field with: "${trimmedFeedback}"`);
    userAttempt.feedback = trimmedFeedback; // Use trimmed feedback
    userAttempt.lastActivity = new Date();

    // Save the updated attempt
    console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Attempting to save updated attempt document...`);
    await userAttempt.save(); // Ensure save is awaited
    console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Feedback saved successfully to DB.`);

    return NextResponse.json({ message: 'Feedback submitted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Error processing feedback:`, error);
     if (error instanceof mongoose.Error.ValidationError) {
         console.error(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Validation Error during save: ${error.message}`);
        return NextResponse.json({ message: `Validation Error: ${error.message}` }, { status: 400 });
    }
    if (error instanceof mongoose.Error.CastError) {
         console.error(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Cast Error: ${error.message}`);
        return NextResponse.json({ message: `Invalid data format: ${error.message}` }, { status: 400 });
    }
     if (error instanceof SyntaxError) {
         console.error(`Feedback Submit: Invalid JSON received.`);
        return NextResponse.json({ message: 'Invalid request format: Malformed JSON' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error processing feedback' }, { status: 500 });
  } finally {
      console.log('--- Feedback Submit Request Finished ---');
  }
}
