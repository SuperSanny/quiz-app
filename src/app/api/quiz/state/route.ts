import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import type { QuizStateData } from '@/types';

export const dynamic = 'force-dynamic' // Ensure this route is always dynamic

export async function GET() {
  try {
    await dbConnect();

    // Find the most recently created quiz state document.
    // This assumes only one quiz can be truly "active" based on creation time if multiple exist.
    // For more robust multi-quiz scenarios, you might need a more specific active flag or session management.
    const currentQuizState = await QuizState.findOne().sort({ createdAt: -1 }); // Get the latest entry

    let responseData: QuizStateData;

    if (currentQuizState) {
      responseData = {
        currentQuestionIndex: currentQuizState.currentQuestionIndex,
        isQuizActive: currentQuizState.isQuizActive,
        quizSessionId: currentQuizState.quizSessionId, // Include session ID
      };
    } else {
      // If no state document exists, return a default inactive state
      responseData = {
        currentQuestionIndex: -1,
        isQuizActive: false,
      };
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0', // Prevent caching for polling
      },
    });
  } catch (error) {
    console.error('Error fetching quiz state:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
