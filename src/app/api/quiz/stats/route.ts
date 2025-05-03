
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import QuizState from '@/models/QuizState';
import type { QuestionStats } from '@/types'; // Ensure QuestionStats includes new fields
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('--- Quiz Stats Request Received ---');
  try {
    await dbConnect();
    console.log('Quiz Stats: DB connected.');

    // 1. Find the *most recent* quiz session (active or inactive) by creation time
    console.log('Quiz Stats: Searching for the most recent quiz session...');
    const lastQuizState = await QuizState.findOne().sort({ createdAt: -1 }); // Sort by creation time descending

    if (!lastQuizState) {
      console.log('Quiz Stats: No quiz sessions found in the database.');
      return NextResponse.json([], { // Return empty array if no quiz ever ran
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    const quizSessionId = lastQuizState.quizSessionId;
    const standardQuestions = lastQuizState.activeQuizQuestions; // Array of standard questions
    const totalStandardQuestions = standardQuestions.length;
    console.log(`Quiz Stats: Found last session ${quizSessionId} (Active: ${lastQuizState.isQuizActive}) with ${totalStandardQuestions} standard questions.`);

    // 2. Fetch all attempts for that specific quiz session
    console.log(`Quiz Stats: Fetching all attempts for session ${quizSessionId}...`);
    const attempts = await Attempt.find(
      { quizSessionId: quizSessionId },
      { answers: 1 } // Projection: only fetch the answers array
    );
    console.log(`Quiz Stats: Found ${attempts.length} attempts for session ${quizSessionId}.`);


    // 3. Calculate statistics for each standard question
    const questionStats: QuestionStats[] = [];

    for (let i = 0; i < totalStandardQuestions; i++) {
      const question = standardQuestions[i];
      if (!question) continue; // Should not happen, but safety check

      let correctCount = 0;
      let incorrectCount = 0; // Added incorrect count
      let totalAttemptsForQuestion = 0;

      attempts.forEach(attempt => {
        // Find if the user attempted this question (only standard questions have answers stored this way)
        const userAnswer = attempt.answers.find(ans => ans.questionIndex === i);
        if (userAnswer) {
          totalAttemptsForQuestion++;
          if (userAnswer.isCorrect) {
            correctCount++;
          } else {
            incorrectCount++; // Increment incorrect count
          }
        }
      });

      // Calculate percentages (handle division by zero)
      const correctPercentage = totalAttemptsForQuestion > 0
        ? (correctCount / totalAttemptsForQuestion) * 100
        : 0;
      const incorrectPercentage = totalAttemptsForQuestion > 0
        ? (incorrectCount / totalAttemptsForQuestion) * 100
        : 0;

      questionStats.push({
        questionIndex: i,
        questionText: question.questionText,
        correctPercentage: correctPercentage,
        incorrectPercentage: incorrectPercentage, // Add incorrect percentage
        totalAttempts: totalAttemptsForQuestion,
        correctCount: correctCount, // Add correct count
        incorrectCount: incorrectCount, // Add incorrect count
      });

      console.log(`Quiz Stats: Q${i+1} - Correct: ${correctCount}, Incorrect: ${incorrectCount}, Total: ${totalAttemptsForQuestion}, Correct%: ${correctPercentage.toFixed(1)}, Incorrect%: ${incorrectPercentage.toFixed(1)}`);
    }

    console.log('Quiz Stats: Statistics calculation complete.');
    return NextResponse.json(questionStats, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0', // Prevent caching
      },
    });

  } catch (error) {
    console.error('Quiz Stats: Error fetching statistics:', error);
    if (error instanceof mongoose.Error) {
         console.error('Quiz Stats: Mongoose specific error:', error.message);
         return NextResponse.json({ message: `Database Error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'Internal Server Error fetching statistics' }, { status: 500 });
  } finally {
      console.log('--- Quiz Stats Request Finished ---');
  }
}
