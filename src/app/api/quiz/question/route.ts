import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import type { Question } from '@/types';

export const dynamic = 'force-dynamic' // Ensure this route is always dynamic

const TOTAL_STANDARD_QUESTIONS = 10; // Consistent definition

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

    if (!quizState) {
      // If session ID doesn't match any quiz state
      return NextResponse.json({ message: 'Quiz session not found' }, { status: 404 });
    }

    // Special check: If the requested index is for the bonus question BUT the quiz is no longer active, treat as finished
    if (index === TOTAL_STANDARD_QUESTIONS && !quizState.isQuizActive) {
      //  console.log(`Question API: Requested bonus question index (${index}) but quiz ${quizSessionId} is inactive. Returning finished.`);
      return NextResponse.json({ isFinished: true }, { status: 200 });
    }


    // Check if quiz is active (standard check)
    if (!quizState.isQuizActive) {
      return NextResponse.json({ message: 'Quiz not active' }, { status: 404 }); // 404 or a custom status?
    }


    // Handle standard questions (index 0 to 9)
    if (index < TOTAL_STANDARD_QUESTIONS) {
      if (index >= quizState.activeQuizQuestions.length) {
        console.error(`Question API: Index ${index} is out of bounds for standard questions (Length: ${quizState.activeQuizQuestions.length}) in session ${quizSessionId}.`);
        return NextResponse.json({ message: 'Question index out of bounds' }, { status: 404 });
      }

      const question: Question = quizState.activeQuizQuestions[index];

      // Return only necessary standard question details
      const questionToSend = {
        id: question.id,
        questionText: question.questionText,
        options: question.options,
      };
      // console.log(`Question API: Returning standard question index ${index} for session ${quizSessionId}.`);
      return NextResponse.json(questionToSend, {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    // Handle bonus question request (index 10)
    else if (index === TOTAL_STANDARD_QUESTIONS) {
      if (!quizState.bonusQuestionText) {
        // This case should ideally be handled by the 'next' API ending the quiz, but handle defensively
        console.warn(`Question API: Requested bonus question index (${index}) but no bonus question text exists in session ${quizSessionId}. Ending quiz state assumed.`);
        return NextResponse.json({ isFinished: true }, { status: 200 }); // Indicate finished
      }

      // Return the bonus question structure
      const bonusQuestionResponse = {
        id: 'bonus-question', // Special ID
        questionText: quizState.bonusQuestionText,
        options: [], // No options for bonus question? Or maybe free-form input? Assuming no MC options.
        isBonusQuestion: true, // Add a flag
      };
      // console.log(`Question API: Returning bonus question for session ${quizSessionId}.`);
      return NextResponse.json(bonusQuestionResponse, {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    // Handle index out of bounds (greater than bonus question index)
    else {
      console.error(`Question API: Index ${index} is out of bounds (greater than bonus question index ${TOTAL_STANDARD_QUESTIONS}) in session ${quizSessionId}.`);
      return NextResponse.json({ message: 'Question index out of bounds' }, { status: 404 });
    }

  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
