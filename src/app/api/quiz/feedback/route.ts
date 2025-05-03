import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const { userId, quizSessionId, feedback } = await request.json();

    // Validate input
    if (!userId || !quizSessionId || feedback === undefined) {
      return NextResponse.json({ message: 'Missing required fields (userId, quizSessionId, feedback)' }, { status: 400 });
    }
     if (!mongoose.Types.ObjectId.isValid(userId)) {
       return NextResponse.json({ message: 'Invalid user ID format' }, { status: 400 });
    }
    if (typeof feedback !== 'string') {
       return NextResponse.json({ message: 'Feedback must be a string' }, { status: 400 });
    }


    // Find the user's attempt document for the specific session
    const userAttempt = await Attempt.findOne({ _id: userId, quizSessionId: quizSessionId });

    if (!userAttempt) {
      return NextResponse.json({ message: 'User attempt not found for this session' }, { status: 404 });
    }

    // Update feedback and last activity
    userAttempt.feedback = feedback.trim(); // Trim whitespace
    userAttempt.lastActivity = new Date();

    // Save the updated attempt
    await userAttempt.save();

    return NextResponse.json({ message: 'Feedback submitted successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error submitting feedback:', error);
     if (error instanceof mongoose.Error.ValidationError) {
        return NextResponse.json({ message: `Validation Error: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
