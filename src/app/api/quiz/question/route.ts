import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import type { Question } from '@/types';

export const dynamic = 'force-dynamic' // Ensure this route is always dynamic

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get('index');
    const quizSessionId = searchParams.get('quizSessionId'); // Get session ID from query params

    if (indexParam === null || quizSessionId === null) {
        return NextResponse.json({ message: 'Missing question index or quiz session ID' }, { status: 400 });
    }

    const index = parseInt(indexParam, 10);

    if (isNaN(index) || index < 0) {
      return NextResponse.json({ message: 'Invalid question index' }, { status: 400 });
    }

    // Find the specific quiz state document using the session ID
    const quizState = await QuizState.findOne({ quizSessionId: quizSessionId });

    if (!quizState || !quizState.isQuizActive) {
      return NextResponse.json({ message: 'Quiz not active or session not found' }, { status: 404 });
    }

    if (index >= quizState.activeQuizQuestions.length) {
       // Handle index out of bounds (e.g., feedback stage or error)
       if (index === 10) { // Check if it's the feedback stage index
         return NextResponse.json({ isFeedbackStage: true }, { status: 200 });
       }
      return NextResponse.json({ message: 'Question index out of bounds' }, { status: 404 });
    }

    const question: Question = quizState.activeQuizQuestions[index];

    // Return only necessary question details, excluding the correct answer
    const questionToSend = {
      id: question.id,
      questionText: question.questionText,
      options: question.options,
    };

    return NextResponse.json(questionToSend, {
        status: 200,
         headers: {
           'Cache-Control': 'no-store, max-age=0', // Prevent caching
         },
      });

  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
