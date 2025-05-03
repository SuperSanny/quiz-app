import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import QuizState from '@/models/QuizState';
import { IAttempt } from '@/models/Attempt';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Find the *current* active quiz session
    const currentQuizState = await QuizState.findOne({ isQuizActive: true }).sort({ createdAt: -1 });

    if (!currentQuizState) {
      return NextResponse.json({ message: 'No active quiz found. Please wait for the admin.' }, { status: 404 });
    }

    const quizSessionId = currentQuizState.quizSessionId;

    // Check if user already exists in this specific session
    let userAttempt = await Attempt.findOne({ userName: trimmedName, quizSessionId });

    if (!userAttempt) {
      // Create new attempt if user doesn't exist for this session
      userAttempt = new Attempt({
        userName: trimmedName,
        quizSessionId: quizSessionId,
        answers: [],
        score: 0,
        feedback: '',
        joinedAt: new Date(),
        lastActivity: new Date(),
      });
      await userAttempt.save();
    } else {
      // Optionally update lastActivity if the user rejoins
      userAttempt.lastActivity = new Date();
      await userAttempt.save();
    }

    // Return user details including the MongoDB document ID and session ID
    return NextResponse.json({
      userId: userAttempt._id.toString(), // Convert ObjectId to string
      userName: userAttempt.userName,
      quizSessionId: userAttempt.quizSessionId,
    }, { status: 201 });

  } catch (error) {
    console.error('Error joining quiz:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
