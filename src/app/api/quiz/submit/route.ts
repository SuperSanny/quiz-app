
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt, { IAttempt } from '@/models/Attempt';
import QuizState from '@/models/QuizState';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  const { userId, quizSessionId, questionIndex, selectedOptionIndex } = await request.json();

  // 1. Validate input
  if (!userId || !quizSessionId || questionIndex === undefined || selectedOptionIndex === undefined) {
    return NextResponse.json({ message: 'Missing required fields (userId, quizSessionId, questionIndex, selectedOptionIndex)' }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
     return NextResponse.json({ message: 'Invalid user ID format' }, { status: 400 });
  }
  if (typeof questionIndex !== 'number' || questionIndex < 0) {
      return NextResponse.json({ message: 'Invalid question index' }, { status: 400 });
  }
   if (typeof selectedOptionIndex !== 'number' || selectedOptionIndex < 0) {
      return NextResponse.json({ message: 'Invalid selected option index' }, { status: 400 });
  }


  // 2. Database Connection
  try {
      await dbConnect();
      console.log(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: DB connected.`);
  } catch (error) {
      console.error(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: DB connection error:`, error);
      return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
  }


  try {
    // 3. Fetch the active quiz state for this session
    const quizState = await QuizState.findOne({ quizSessionId: quizSessionId, isQuizActive: true });
    if (!quizState) {
       console.warn(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Quiz session not found or not active.`);
      return NextResponse.json({ message: 'Quiz session not found or not active' }, { status: 404 });
    }

    // 4. Validate questionIndex against the active questions
    if (questionIndex >= quizState.activeQuizQuestions.length) {
       console.warn(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Invalid question index for this session (Max: ${quizState.activeQuizQuestions.length - 1}).`);
      return NextResponse.json({ message: 'Invalid question index for this quiz session' }, { status: 400 });
    }

     // Ensure user is submitting for the *current* question index shown by admin
     if (questionIndex !== quizState.currentQuestionIndex) {
         console.warn(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Attempted to submit for non-current question (Current: ${quizState.currentQuestionIndex}).`);
         return NextResponse.json({ message: `You can only answer the current question (${quizState.currentQuestionIndex + 1})` }, { status: 400 });
     }


    // 5. Get the correct answer
    const correctAnswerIndex = quizState.activeQuizQuestions[questionIndex].correctAnswerIndex;
    const isCorrect = selectedOptionIndex === correctAnswerIndex;

    // 6. Find the user's attempt document using findOneAndUpdate for potential atomicity
    // We use findOneAndUpdate to potentially update the answer array and score in one go.
     const userAttempt = await Attempt.findById(userId);

    if (!userAttempt) {
         console.warn(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: User attempt document not found.`);
         return NextResponse.json({ message: 'User attempt not found.' }, { status: 404 });
    }

     // Verify the attempt belongs to the correct session (important if user ID could exist across sessions)
     if (userAttempt.quizSessionId !== quizSessionId) {
         console.warn(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Attempt document session ID (${userAttempt.quizSessionId}) mismatch.`);
         return NextResponse.json({ message: 'User attempt session mismatch.' }, { status: 400 });
     }


    // 7. Check if the user has already answered this question in this session
    const existingAnswer = userAttempt.answers.find(ans => ans.questionIndex === questionIndex);
    if (existingAnswer) {
        console.log(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Answer already submitted.`);
        // Return previous result to the user
        return NextResponse.json({ message: 'Answer already submitted for this question', isCorrect: existingAnswer.isCorrect }, { status: 200 }); // 200 OK, but indicate already submitted
    }

    // 8. Add the new answer and update score/activity atomically (within the save)
    userAttempt.answers.push({
      questionIndex,
      selectedOptionIndex,
      isCorrect,
      timestamp: new Date(),
    });

    if (isCorrect) {
      userAttempt.score += 1;
    }
    userAttempt.lastActivity = new Date();

    // Save the updated attempt
    await userAttempt.save();
    console.log(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Answer saved successfully. Correct: ${isCorrect}, New Score: ${userAttempt.score}.`);

    return NextResponse.json({ message: 'Answer submitted successfully', isCorrect: isCorrect }, { status: 200 });

  } catch (error) {
    console.error(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Error processing submission:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
        console.error(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Validation Error:`, error.message);
        return NextResponse.json({ message: `Validation Error: ${error.message}` }, { status: 400 });
    }
     if (error instanceof mongoose.Error.CastError) {
         console.error(`Submit Answer [${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Cast Error:`, error.message);
        return NextResponse.json({ message: `Invalid data format: ${error.message}` }, { status: 400 });
    }
    // General internal server error for other cases
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
```