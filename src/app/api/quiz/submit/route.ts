import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt, { IAttempt } from '@/models/Attempt';
import QuizState from '@/models/QuizState';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { userId, quizSessionId, questionIndex, selectedOptionIndex } = await request.json();

    // Validate input
    if (!userId || !quizSessionId || questionIndex === undefined || selectedOptionIndex === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
       return NextResponse.json({ message: 'Invalid user ID format' }, { status: 400 });
    }


    // Fetch the current quiz state for this specific session
    const quizState = await QuizState.findOne({ quizSessionId: quizSessionId, isQuizActive: true });
    if (!quizState) {
      return NextResponse.json({ message: 'Quiz session not found or not active' }, { status: 404 });
    }

    // Validate questionIndex against the active questions
    if (questionIndex < 0 || questionIndex >= quizState.activeQuizQuestions.length) {
      return NextResponse.json({ message: 'Invalid question index for this quiz session' }, { status: 400 });
    }

    // Get the correct answer from the server-side stored questions
    const correctAnswerIndex = quizState.activeQuizQuestions[questionIndex].correctAnswerIndex;
    const isCorrect = selectedOptionIndex === correctAnswerIndex;

    // Find the user's attempt document
    const userAttempt = await Attempt.findById(userId);

    if (!userAttempt || userAttempt.quizSessionId !== quizSessionId) {
      return NextResponse.json({ message: 'User attempt not found for this session' }, { status: 404 });
    }

    // Check if the user has already answered this question in this session
    const existingAnswer = userAttempt.answers.find(ans => ans.questionIndex === questionIndex);
    if (existingAnswer) {
      // Optionally allow re-submission or return an error/message
      // For now, we'll just return a confirmation without updating score again
       return NextResponse.json({ message: 'Answer already submitted for this question', isCorrect: existingAnswer.isCorrect }, { status: 200 });
      // return NextResponse.json({ message: 'Answer already submitted for this question' }, { status: 409 }); // Conflict
    }

    // Add the new answer
    userAttempt.answers.push({
      questionIndex,
      selectedOptionIndex,
      isCorrect,
      timestamp: new Date(),
    });

    // Update the score if the answer is correct
    if (isCorrect) {
      userAttempt.score += 1;
    }

    // Update last activity timestamp
    userAttempt.lastActivity = new Date();

    // Save the updated attempt
    await userAttempt.save();

    return NextResponse.json({ message: 'Answer submitted successfully', isCorrect: isCorrect }, { status: 200 });

  } catch (error) {
    console.error('Error submitting answer:', error);
    // Handle potential mongoose validation errors or other DB issues
    if (error instanceof mongoose.Error.ValidationError) {
        return NextResponse.json({ message: `Validation Error: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
