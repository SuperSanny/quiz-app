import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState, { IQuizState } from '@/models/QuizState';
import Attempt from '@/models/Attempt'; // Import Attempt to potentially clear old data if needed
import { getRandomQuestions } from '@/lib/questions';
import { v4 as uuidv4 } from 'uuid'; // For generating unique session IDs

// Basic password protection (replace with a more secure method in production)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'; // Use environment variable

export async function POST(request: Request) {
  try {
     // Check admin password from headers or body (simple example)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
         // Alternatively check password from request body:
         // const { password } = await request.json(); // Assuming password sent in body
         // if (password !== ADMIN_PASSWORD) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
         // }
    }


    const mongoconnect = await dbConnect();

    // --- Optional: Clean up old quiz states or attempts ---
    // Deactivate any previous active quizzes
    await QuizState.updateMany({ isQuizActive: true }, { $set: { isQuizActive: false } });
    // Consider if you want to clear old attempts or keep history.
    // await Attempt.deleteMany({}); // Uncomment to clear all previous attempts

    // Generate a unique ID for this new quiz session
    const newQuizSessionId = uuidv4();

    // Get 10 random questions
    const selectedQuestions = getRandomQuestions(10);

    if (selectedQuestions.length === 0) {
      return NextResponse.json({ message: 'Failed to load questions' }, { status: 500 });
    }

    // Create a new quiz state document
    const newQuizState = new QuizState({
      currentQuestionIndex: 0, // Start at the first question
      isQuizActive: true,
      activeQuizQuestions: selectedQuestions,
      quizSessionId: newQuizSessionId, // Assign the unique session ID
      createdAt: new Date(), // Explicitly set createdAt for sorting reliability if needed
    });

    await newQuizState.save();

    return NextResponse.json({ message: 'Quiz started successfully', quizSessionId: newQuizSessionId }, { status: 200 });

  } catch (error) {
    console.error('Error starting quiz:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
