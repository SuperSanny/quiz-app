import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import type { ScoreData } from '@/types';
import QuizState from '@/models/QuizState'; // Import QuizState to get the active session

export const dynamic = 'force-dynamic' // Ensure this route is always dynamic

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

     // Find the current active quiz session ID
    const currentQuizState = await QuizState.findOne({ isQuizActive: true }).sort({ createdAt: -1 });

    if (!currentQuizState) {
      // If no active quiz, return empty scores or a specific message
      return NextResponse.json([], {
         status: 200,
         headers: { 'Cache-Control': 'no-store, max-age=0' },
       });
    }

    const quizSessionId = currentQuizState.quizSessionId;


    // Fetch attempts only for the current active quiz session
    const attempts = await Attempt.find(
        { quizSessionId: quizSessionId }, // Filter by active session ID
        { _id: 1, score: 1, lastActivity: 1 } // Projection: get _id (userId), score, and lastActivity for tie-breaking
      )
      .sort({ score: -1, lastActivity: 1 }); // Sort by score descending, then by activity ascending


    // Add ranking logic
    let rank = 0;
    let lastScore = Infinity;
    let usersAtRank = 0;

    const rankedScores: ScoreData[] = attempts.map((attempt) => {
        if (attempt.score < lastScore) {
            rank += usersAtRank;
            rank++;
            lastScore = attempt.score;
            usersAtRank = 1;
        } else {
            usersAtRank++;
        }
        return {
            userId: attempt._id.toString(), // Return userId (_id as string)
            score: attempt.score,
            rank: rank,
        };
    });


    return NextResponse.json(rankedScores, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0', // Crucial for polling
      },
    });
  } catch (error) {
    console.error('Error fetching scores:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
