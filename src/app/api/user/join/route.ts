
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt from '@/models/Attempt';
import QuizState from '@/models/QuizState';
import { IAttempt } from '@/models/Attempt';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  let name = ''; // Initialize name to handle potential errors during JSON parsing
  try {
    const body = await request.json();
    name = body.name;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ message: 'Name is required and must be a non-empty string' }, { status: 400 });
    }

    const trimmedName = name.trim();
     if (trimmedName.length > 50) { // Add length validation
       return NextResponse.json({ message: 'Name cannot exceed 50 characters' }, { status: 400 });
     }


    // 1. Database Connection
    try {
        await dbConnect();
        console.log(`User Join [${trimmedName}]: DB connected.`);
    } catch (dbError) {
        console.error(`User Join [${trimmedName}]: DB connection error:`, dbError);
        return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
    }

    // 2. Find the *current* active quiz session
    let currentQuizState;
    try {
        currentQuizState = await QuizState.findOne({ isQuizActive: true }).sort({ createdAt: -1 });
    } catch (findStateError) {
        console.error(`User Join [${trimmedName}]: Error finding active quiz state:`, findStateError);
        return NextResponse.json({ message: 'Internal Server Error: Could not retrieve quiz status' }, { status: 500 });
    }

    if (!currentQuizState) {
      console.log(`User Join [${trimmedName}]: No active quiz found.`);
      return NextResponse.json({ message: 'No active quiz found. Please wait for the admin to start.' }, { status: 404 });
    }

    const quizSessionId = currentQuizState.quizSessionId;
    console.log(`User Join [${trimmedName}]: Joining active session ${quizSessionId}`);

    // 3. Find or Create User Attempt for this specific session
    let userAttempt: IAttempt | null = null;
    try {
        // Use findOneAndUpdate with upsert:true to atomically find or create the user attempt
        userAttempt = await Attempt.findOneAndUpdate(
            { userName: trimmedName, quizSessionId: quizSessionId }, // Filter
            {
                $setOnInsert: { // Fields to set only if a new document is created (upserted)
                    userName: trimmedName,
                    quizSessionId: quizSessionId,
                    answers: [],
                    score: 0,
                    feedback: '',
                    joinedAt: new Date(),
                },
                $set: { // Fields to update regardless (e.g., update last activity on rejoin)
                    lastActivity: new Date()
                }
            },
            {
                new: true, // Return the modified document (or the new one if created)
                upsert: true, // Create the document if it doesn't exist
                runValidators: true, // Ensure schema validation runs on upsert
            }
        );

        if (!userAttempt) {
            // This should theoretically not happen with upsert: true unless there's a severe db issue
            console.error(`User Join [${trimmedName}, Session: ${quizSessionId}]: Failed to find or create user attempt despite using upsert.`);
            return NextResponse.json({ message: 'Internal Server Error: Failed to register user.' }, { status: 500 });
        }

        console.log(`User Join [${trimmedName}, Session: ${quizSessionId}]: User registered/found with ID: ${userAttempt._id}.`);


        // 4. Return user details
        return NextResponse.json({
            userId: userAttempt._id.toString(), // Convert ObjectId to string
            userName: userAttempt.userName,
            quizSessionId: userAttempt.quizSessionId,
        }, { status: userAttempt.createdAt.getTime() === userAttempt.updatedAt.getTime() ? 201 : 200 }); // 201 if created, 200 if updated

    } catch (error) {
         console.error(`User Join [${trimmedName}, Session: ${quizSessionId}]: Error finding/creating attempt:`, error);
         if (error instanceof mongoose.Error.ValidationError) {
            console.error(`User Join [${trimmedName}, Session: ${quizSessionId}]: Validation Error:`, error.message);
            return NextResponse.json({ message: `Validation Error: ${error.message}` }, { status: 400 });
         }
         // Check for potential duplicate key error if index isn't working as expected (though upsert handles this case)
         if ((error as any).code === 11000) {
             console.error(`User Join [${trimmedName}, Session: ${quizSessionId}]: Duplicate key error (should be handled by upsert):`, error);
             // Attempt to fetch the existing user again as a fallback
             try {
                const existingUser = await Attempt.findOne({ userName: trimmedName, quizSessionId: quizSessionId });
                if (existingUser) {
                     return NextResponse.json({
                        userId: existingUser._id.toString(),
                        userName: existingUser.userName,
                        quizSessionId: existingUser.quizSessionId,
                    }, { status: 200 });
                }
             } catch (fallbackError) {
                 console.error(`User Join [${trimmedName}, Session: ${quizSessionId}]: Fallback fetch error after duplicate key:`, fallbackError);
             }
             return NextResponse.json({ message: 'Error processing registration, possibly duplicate entry.' }, { status: 409 }); // Conflict
         }
         return NextResponse.json({ message: 'Internal Server Error during registration.' }, { status: 500 });
    }

  } catch (error) {
    // Handle errors in request parsing or initial validation
    console.error(`User Join [${name || 'unknown'}]: Error processing join request:`, error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ message: 'Invalid request format' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
```