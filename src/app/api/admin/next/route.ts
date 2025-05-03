import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';

// Basic password protection (ensure consistency with /start)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

export async function POST(request: Request) {
   try {
     // Check admin password
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
        // const { password } = await request.json();
        // if (password !== ADMIN_PASSWORD) {
          return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        // }
    }


    await dbConnect();

    // Find the *current* active quiz state
    // Sorting by createdAt ensures we update the most recent active quiz if multiple somehow exist
    const currentQuizState = await QuizState.findOne({ isQuizActive: true }).sort({ createdAt: -1 });

    if (!currentQuizState) {
      return NextResponse.json({ message: 'No active quiz found to advance' }, { status: 404 });
    }

    const totalQuestions = currentQuizState.activeQuizQuestions.length; // Typically 10
    const nextIndex = currentQuizState.currentQuestionIndex + 1;

    // Update the current question index
    // Allow index to go up to totalQuestions (e.g., 10) for the feedback stage
    if (nextIndex <= totalQuestions) {
       currentQuizState.currentQuestionIndex = nextIndex;
       await currentQuizState.save();
        return NextResponse.json({ message: `Advanced to question index ${nextIndex}`, newIndex: nextIndex }, { status: 200 });
    } else {
        // Quiz is already finished or past the feedback stage
        // Optionally set isQuizActive to false here, or handle finishing separately
        // currentQuizState.isQuizActive = false;
        // await currentQuizState.save();
        return NextResponse.json({ message: 'Quiz already finished or past feedback stage', currentIdex: currentQuizState.currentQuestionIndex }, { status: 400 });
    }


  } catch (error) {
    console.error('Error advancing question:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
