
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import QuizState from '@/models/QuizState';
import type { QuizStateData } from '@/types';
import mongoose from 'mongoose'; // Import mongoose for error checking

export const dynamic = 'force-dynamic' // Ensure this route is always dynamic

export async function GET() {
  console.log('--- Get Quiz State Request Received ---');
  try {
    // console.log('Get Quiz State: Attempting DB connection...');
    await dbConnect();
    // console.log('Get Quiz State: DB connected successfully.');

    // console.log('Get Quiz State: Finding most recent quiz state...');
    // Find the most recently created quiz state document.
    const currentQuizState = await QuizState.findOne().sort({ createdAt: -1 }); // Get the latest entry
    console.log(`Get Quiz State: Found quiz state - ${currentQuizState ? `ID: ${currentQuizState._id}, Session: ${currentQuizState.quizSessionId}, Active: ${currentQuizState.isQuizActive}` : 'None found'}`);

    let responseData: QuizStateData;

    if (currentQuizState) {
      responseData = {
        currentQuestionIndex: currentQuizState.currentQuestionIndex,
        isQuizActive: currentQuizState.isQuizActive,
        quizSessionId: currentQuizState.quizSessionId, // Include session ID
      };
      // console.log('Get Quiz State: Prepared response data from existing state:', responseData);
    } else {
      // If no state document exists, return a default inactive state
      responseData = {
        currentQuestionIndex: -1,
        isQuizActive: false,
        quizSessionId: undefined, // Explicitly set to undefined
      };
      // console.log('Get Quiz State: No quiz state found, returning default inactive state:', responseData);
    }

    // console.log('Get Quiz State: Sending response.');
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0', // Prevent caching for polling
      },
    });
  } catch (error: any) {
    console.error('--- ERROR in Get Quiz State ---');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);

    // Log Mongoose specific errors if applicable
    if (error instanceof mongoose.Error) {
      console.error('Mongoose Error Details:', error);
    }

    // Provide a generic server error response
    return NextResponse.json(
      { message: 'Internal Server Error fetching quiz state. Check server logs for details.' },
      { status: 500 }
    );
  } finally {
    console.log('--- Get Quiz State Request Finished ---');
  }
}
