
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import mongoose from 'mongoose';
import QuizState from '@/models/QuizState'; // Import QuizState

export async function POST(request: Request) {
   let userId: string | null = null;
   let quizSessionId: string | null = null;

  try {
    await dbConnect();
    console.log("Feedback Submit: DB connected.");

    const { userId: reqUserId, quizSessionId: reqQuizSessionId, feedback } = await request.json();
    userId = reqUserId; // Assign for logging in catch block
    quizSessionId = reqQuizSessionId;

    // Validate input
    if (!userId || !quizSessionId || feedback === undefined) {
        console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Missing required fields.`);
      return NextResponse.json({ message: 'Missing required fields (userId, quizSessionId, feedback)' }, { status: 400 });
    }
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Invalid user ID format.`);
       return NextResponse.json({ message: 'Invalid user ID format' }, { status: 400 });
    }
    if (typeof feedback !== 'string') {
        console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Feedback is not a string.`);
       return NextResponse.json({ message: 'Feedback must be a string' }, { status: 400 });
    }
     const trimmedFeedback = feedback.trim();
     if (trimmedFeedback.length > 1000) { // Add length limit
         console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Feedback exceeds 1000 characters.`);
         return NextResponse.json({ message: 'Feedback cannot exceed 1000 characters.' }, { status: 400 });
     }

      // Optional: Verify the quiz session is actually in the feedback stage or finished
       const quizState = await QuizState.findOne({ quizSessionId: quizSessionId });
       if (!quizState) {
           console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Quiz session not found.`);
           return NextResponse.json({ message: 'Quiz session not found.' }, { status: 404 });
       }
       // Only allow feedback if the quiz is at the feedback stage (index 10) or finished (inactive)
       if (quizState.isQuizActive && quizState.currentQuestionIndex !== quizState.activeQuizQuestions.length) {
           console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Attempted to submit feedback before feedback stage (Current index: ${quizState.currentQuestionIndex}).`);
           return NextResponse.json({ message: 'Cannot submit feedback until the feedback stage.' }, { status: 400 });
       }


    // Find the user's attempt document for the specific session
    console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Finding user attempt...`);
    const userAttempt = await Attempt.findOne({ _id: userId, quizSessionId: quizSessionId });

    if (!userAttempt) {
       console.warn(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: User attempt not found.`);
      return NextResponse.json({ message: 'User attempt not found for this session' }, { status: 404 });
    }

    // Update feedback and last activity
    console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Updating feedback.`);
    userAttempt.feedback = trimmedFeedback; // Use trimmed feedback
    userAttempt.lastActivity = new Date();

    // Save the updated attempt
    await userAttempt.save();
    console.log(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Feedback saved successfully.`);

    return NextResponse.json({ message: 'Feedback submitted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Error submitting feedback:`, error);
     if (error instanceof mongoose.Error.ValidationError) {
         console.error(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Validation Error: ${error.message}`);
        return NextResponse.json({ message: `Validation Error: ${error.message}` }, { status: 400 });
    }
    if (error instanceof mongoose.Error.CastError) {
         console.error(`Feedback Submit [User: ${userId}, Session: ${quizSessionId}]: Cast Error: ${error.message}`);
        return NextResponse.json({ message: `Invalid data format: ${error.message}` }, { status: 400 });
    }
     if (error instanceof SyntaxError) {
         console.error(`Feedback Submit: Invalid JSON received.`);
        return NextResponse.json({ message: 'Invalid request format' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
```