
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Attempt, { IAttempt, StandardAnswer } from '@/models/Attempt'; // Import updated interface and type
import QuizState from '@/models/QuizState';
import mongoose from 'mongoose';

const TOTAL_STANDARD_QUESTIONS = 10; // Number of standard questions

export async function POST(request: Request) {
  let userId: string | null = null;
  let quizSessionId: string | null = null;
  let questionIndex: number | null = null;
  let reqPayload: any = {}; // To hold parsed payload for logging

  console.log('--- Submit Answer Request Received ---');
  try {
    reqPayload = await request.json();
    userId = reqPayload.userId; // Get userId (Attempt._id) from payload
    quizSessionId = reqPayload.quizSessionId;
    questionIndex = reqPayload.questionIndex;
    const selectedOptionIndex = reqPayload.selectedOptionIndex; // May not exist for bonus
    const bonusAnswerText = reqPayload.bonusAnswerText; // Get bonus answer text

    console.log(`Submit Answer: Payload received - UserID: ${userId}, Session: ${quizSessionId}, QIndex: ${questionIndex}, SelectedOption: ${selectedOptionIndex}, BonusText provided: ${bonusAnswerText !== undefined}`);


    // 1. Validate input
    if (!userId || !quizSessionId || questionIndex === undefined || questionIndex === null) {
      console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Validation Failed - Missing required fields (userId, quizSessionId, questionIndex).`);
      return NextResponse.json({ message: 'Missing required fields (userId, quizSessionId, questionIndex)' }, { status: 400 });
    }
     // Validate userId format
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Validation Failed - Invalid user ID format.`);
        return NextResponse.json({ message: 'Invalid user ID format' }, { status: 400 });
     }
    // Validate question index type
    if (typeof questionIndex !== 'number' || questionIndex < 0) {
        console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Validation Failed - Invalid question index type or value.`);
        return NextResponse.json({ message: 'Invalid question index' }, { status: 400 });
    }
    // Validate selectedOptionIndex ONLY for standard questions
     if (questionIndex < TOTAL_STANDARD_QUESTIONS && (typeof selectedOptionIndex !== 'number' || selectedOptionIndex < 0)) {
        console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Validation Failed - Invalid selected option index for standard question.`);
        return NextResponse.json({ message: 'Invalid selected option index for standard question.' }, { status: 400 });
    }
     // Validate bonusAnswerText ONLY for the bonus question
     if (questionIndex === TOTAL_STANDARD_QUESTIONS && typeof bonusAnswerText !== 'string') {
         // Allow empty string "" for bonus answer submission
         console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Validation Failed - Invalid bonus answer text type.`);
         return NextResponse.json({ message: 'Invalid bonus answer text format. Expected a string.' }, { status: 400 });
     }
    console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Input validation passed.`);


    // 2. Database Connection
    try {
        await dbConnect();
        console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: DB connected.`);
    } catch (dbError) {
        console.error(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: DB connection error:`, dbError);
        return NextResponse.json({ message: 'Internal Server Error: Database connection failed' }, { status: 500 });
    }


    // 3. Fetch the quiz state for this session
    let quizState;
    console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Fetching quiz state...`);
    try {
        // Find the quiz state for the GIVEN session ID.
        quizState = await QuizState.findOne({ quizSessionId: quizSessionId });
        if (!quizState) {
           console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Quiz session not found.`);
          return NextResponse.json({ message: 'Quiz session not found' }, { status: 404 });
        }
         console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Quiz state found. Active: ${quizState.isQuizActive}. Admin index: ${quizState.currentQuestionIndex}`);

    } catch (error) {
        console.error(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Error fetching quiz state:`, error);
        return NextResponse.json({ message: 'Internal Server Error fetching quiz state' }, { status: 500 });
    }

     // 4. Ensure user is submitting for the *current* question index (or bonus) according to admin *if quiz is active*
     if (quizState.isQuizActive && questionIndex !== quizState.currentQuestionIndex) {
          console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Attempted to submit for non-current question (Admin is at: ${quizState.currentQuestionIndex}).`);
          const displayIndex = quizState.currentQuestionIndex < TOTAL_STANDARD_QUESTIONS
                               ? `question ${quizState.currentQuestionIndex + 1}`
                               : 'the bonus question';
          return NextResponse.json({ message: `Submission rejected. The current stage is ${displayIndex}.` }, { status: 400 });
      }
     // If quiz is NOT active, reject submissions (prevents late submissions after quiz end)
      else if (!quizState.isQuizActive) {
          console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Attempted to submit but quiz is inactive.`);
          return NextResponse.json({ message: `Submission rejected. The quiz is no longer active.` }, { status: 400 });
      }
     console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Question index check passed.`);


    // 5. Get the correct answer for STANDARD questions
    let isCorrect = false;
    if (questionIndex < TOTAL_STANDARD_QUESTIONS) {
         // Validate standard question index against available questions
        if (questionIndex >= quizState.activeQuizQuestions.length) {
           console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Invalid standard question index for this session (Max: ${quizState.activeQuizQuestions.length - 1}).`);
          return NextResponse.json({ message: 'Invalid question index for this quiz session' }, { status: 400 });
        }
        const correctAnswerIndex = quizState.activeQuizQuestions[questionIndex].correctAnswerIndex;
        isCorrect = selectedOptionIndex === correctAnswerIndex;
        console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Correct answer index is ${correctAnswerIndex}. User selected ${selectedOptionIndex}. isCorrect: ${isCorrect}`);
    } else if (questionIndex === TOTAL_STANDARD_QUESTIONS) {
        // Bonus question - correctness is not determined here, just record the answer
        console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Received submission for bonus question.`);
        // No isCorrect check for bonus
    }


    // 6. Find the user's attempt document
     let userAttempt: IAttempt | null = null; // Use the specific interface type
     console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Finding user attempt document by ID...`);
     try {
        userAttempt = await Attempt.findById(userId);

        if (!userAttempt) {
             console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: User attempt document not found.`);
             return NextResponse.json({ message: 'User attempt not found.' }, { status: 404 });
        }
        console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: User attempt document found.`);

         // Verify the attempt belongs to the correct session
         if (userAttempt.quizSessionId !== quizSessionId) {
             console.warn(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Attempt document session ID (${userAttempt.quizSessionId}) does not match request session ID.`);
             return NextResponse.json({ message: 'User attempt session mismatch.' }, { status: 400 });
         }
         console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Session ID match confirmed.`);

    } catch (error) {
        console.error(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Error finding user attempt:`, error);
        return NextResponse.json({ message: 'Internal Server Error finding user attempt' }, { status: 500 });
    }


    // 7. Check for existing submission for this specific question *type*
    console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Checking for existing submission...`);
    let alreadySubmitted = false;
    if (questionIndex < TOTAL_STANDARD_QUESTIONS) {
        // Check standard answers array
        alreadySubmitted = userAttempt.answers.some(ans => ans.questionIndex === questionIndex);
    } else {
        // Check if bonus answer text already exists (is not null/undefined and not empty string perhaps?)
        // Allowing overwrite of bonus answer for now, but could prevent it here.
        // alreadySubmitted = userAttempt.bonusAnswerText !== null && userAttempt.bonusAnswerText !== undefined;
        // Let's check if it's non-null to prevent repeated "first" submissions.
        alreadySubmitted = userAttempt.bonusAnswerText !== null;
    }

    if (alreadySubmitted) {
        console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: User has already submitted for this question/bonus. Rejecting duplicate.`);
        // Return a clear message indicating it's a duplicate.
        const message = questionIndex < TOTAL_STANDARD_QUESTIONS
            ? 'Answer already submitted for this question.'
            : 'Bonus answer already submitted.';
        return NextResponse.json({ message: message, alreadySubmitted: true }, { status: 409 }); // 409 Conflict
    }
    console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: No existing submission found. Proceeding to save.`);


    // 8. Update attempt document based on question type
    const now = new Date();
    userAttempt.lastActivity = now; // Always update last activity

    if (questionIndex < TOTAL_STANDARD_QUESTIONS) {
        // Add standard answer to the array
        const newAnswer: StandardAnswer = {
          questionIndex,
          selectedOptionIndex: selectedOptionIndex!, // Should be validated by now
          isCorrect: isCorrect,
          timestamp: now,
        };
        userAttempt.answers.push(newAnswer);

        // Update score only for correct standard answers
        const scoreBefore = userAttempt.score;
        if (isCorrect) {
          userAttempt.score += 1;
        }
         console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Prepared standard answer. Score change: ${scoreBefore} -> ${userAttempt.score}. Last activity updated.`);
    } else {
        // Update the bonusAnswerText field
        userAttempt.bonusAnswerText = bonusAnswerText || ''; // Save the text (or empty string if submitted empty)
        console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Prepared bonus answer text: "${userAttempt.bonusAnswerText}". Last activity updated.`);
         // Score is not updated for bonus question here
    }


    // 9. Save the updated attempt document
    console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Attempting to save user attempt document...`);
    try {
        await userAttempt.save();
        console.log(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Submission saved successfully to DB. Final Score: ${userAttempt.score}. Bonus Answer: ${userAttempt.bonusAnswerText}`);
        // Return different payload based on question type
         const returnPayload = questionIndex < TOTAL_STANDARD_QUESTIONS
                               ? { message: 'Answer submitted successfully', isCorrect: isCorrect }
                               : { message: 'Bonus answer submitted successfully' };
        return NextResponse.json(returnPayload, { status: 200 });
    } catch (saveError) {
        console.error(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Error saving user attempt document:`, saveError);
        if (saveError instanceof mongoose.Error.ValidationError) {
             console.error(`Submit Answer [UserID: ${userId}, Session: ${quizSessionId}, Q:${questionIndex}]: Validation Error during save:`, saveError.message);
            return NextResponse.json({ message: `Validation Error: ${saveError.message}` }, { status: 400 });
        }
        return NextResponse.json({ message: 'Internal Server Error saving submission' }, { status: 500 });
    }


  } catch (error) {
    console.error(`Submit Answer [UserID: ${userId || 'unknown'}, Session: ${quizSessionId || 'unknown'}, Q:${questionIndex ?? 'unknown'}]: Top-level error processing submission:`, error);
    if (error instanceof SyntaxError) {
         console.error(`Submit Answer: Invalid JSON received.`);
        return NextResponse.json({ message: 'Invalid request format: Malformed JSON' }, { status: 400 });
    }
     if (error instanceof mongoose.Error.CastError) {
         console.error(`Submit Answer [UserID: ${userId || 'unknown'}, Session: ${quizSessionId || 'unknown'}, Q:${questionIndex ?? 'unknown'}]: Cast Error (likely invalid ID format in payload):`, error.message);
        return NextResponse.json({ message: `Invalid data format: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error processing submission' }, { status: 500 });
  } finally {
     console.log('--- Submit Answer Request Finished ---');
  }
}
