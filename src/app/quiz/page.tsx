
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
// import { Input } from '@/components/ui/input'; // No longer needed for name
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea'; // For bonus question answer
import { useToast } from '@/hooks/use-toast';
import type { Question, QuizStateData, UserInfo } from '@/types';
import { Loader2, CheckCircle, XCircle, Send, UserPlus } from 'lucide-react'; // Import icons, though Check/X will be removed from render

const QUIZ_STATE_POLL_INTERVAL = 2000; // Poll quiz state every 2 seconds
const TOTAL_STANDARD_QUESTIONS = 10;

// Updated stages to reflect anonymous join and bonus question
type QuizStage = 'initial' | 'joining' | 'waiting_start' | 'showing_question' | 'submitted_answer' | 'showing_bonus' | 'submitted_bonus' | 'finished' | 'error';

interface CurrentQuestionDisplay extends Omit<Question, 'correctAnswerIndex'> {
 isBonusQuestion?: boolean; // Flag for the bonus question
 isFinished?: boolean; // Flag if API indicates quiz finished
}


export default function QuizPage() {
  // const [userName, setUserName] = useState(''); // Removed user name state
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null); // Stores userId, quizSessionId
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<QuizStage>('initial'); // Start at 'initial' stage
  const [quizState, setQuizState] = useState<QuizStateData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestionDisplay | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [bonusAnswerText, setBonusAnswerText] = useState(''); // State for bonus answer input
  // const [lastAnswerResult, setLastAnswerResult] = useState<{ isCorrect: boolean } | null>(null); // No longer needed visually
  const { toast } = useToast();

  const currentQuestionIndexRef = useRef<number>(-1); // Ref to track the last processed question index

   // --- Effect for Polling Quiz State ---
   useEffect(() => {
    // Only poll if user has joined (userInfo is set) AND quiz is not finished/errored out
    if (!userInfo || stage === 'finished' || stage === 'error') return;

    let isActive = true; // Flag to prevent state updates after unmount
    const intervalId = setInterval(async () => {
      if (!isActive) return;
      try {
        const res = await fetch('/api/quiz/state');
        if (!res.ok) {
          console.error(`Failed to fetch quiz state: ${res.status}`);
           if (res.status === 404 && isActive) {
              setStage('error');
              toast({ title: 'Error', description: 'Quiz session not found or ended unexpectedly.', variant: 'destructive'});
              clearInterval(intervalId);
           }
           // Add check for 500 specifically if needed
            else if (res.status === 500 && isActive) {
              console.error("Server error (500) fetching quiz state. Check server logs.");
              toast({ title: 'Server Error', description: 'Could not fetch quiz status. Please check server logs or retry later.', variant: 'destructive'});
               // Optionally stop polling on persistent 500s, or let it retry
               // clearInterval(intervalId);
               // setStage('error');
           }
          return;
        }
        const data: QuizStateData = await res.json();

        if (isActive) {
            setQuizState(data);
        }

      } catch (error) {
        console.error('Polling error:', error);
        // Add a toast for network errors during polling if needed
         // if (isActive) {
         //    toast({ title: 'Network Error', description: 'Could not connect to check quiz status. Retrying...', variant: 'destructive' });
         // }
      }
    }, QUIZ_STATE_POLL_INTERVAL);

     return () => {
        isActive = false;
        clearInterval(intervalId);
     };
  }, [userInfo, stage, toast]); // Depend on userInfo and stage


  // --- Effect for Handling Quiz State Changes ---
   useEffect(() => {
    if (!quizState || !userInfo) return; // Need state and user info

    const newIndex = quizState.currentQuestionIndex;
    const isActive = quizState.isQuizActive;
    const userSessionId = userInfo.quizSessionId;

    // Check if the quizSessionId matches the user's session
    if (quizState.quizSessionId && userSessionId !== quizState.quizSessionId) {
        setStage('error');
        toast({ title: 'Session Mismatch', description: 'You joined a different quiz session than the current one. Please rejoin.', variant: 'destructive' });
        setUserInfo(null); // Reset user info
        currentQuestionIndexRef.current = -1;
        setQuizState(null);
        setCurrentQuestion(null);
        setStage('initial'); // Go back to initial join screen
        return;
    }

    // If quiz becomes inactive WHILE user is participating
     if (!isActive && stage !== 'initial' && stage !== 'joining' && stage !== 'finished' && stage !== 'error') {
         // Quiz ended by admin or automatically after bonus question was skipped
          console.log('Quiz became inactive. Moving to finished stage.');
          setStage('finished');
          currentQuestionIndexRef.current = newIndex; // Update ref
          return;
     }

    // If quiz is active and index has changed from the last processed index
     if (isActive && newIndex !== currentQuestionIndexRef.current) {
       const previousIndex = currentQuestionIndexRef.current;
       currentQuestionIndexRef.current = newIndex; // Update ref immediately
       // setLastAnswerResult(null); // No longer needed visually
       setSelectedOption(null); // Reset selection for standard questions
       setBonusAnswerText(''); // Clear bonus answer text
       setCurrentQuestion(null); // Clear old question
       setIsLoading(true); // Show loading state

       console.log(`Quiz state changed: Index from ${previousIndex} to ${newIndex}`);

       // Index -1: Waiting to start
       if (newIndex === -1) {
         setStage('waiting_start');
         setIsLoading(false);
       }
       // Index 0-9: Fetch standard question
       else if (newIndex >= 0 && newIndex < TOTAL_STANDARD_QUESTIONS) {
         console.log(`Fetching standard question ${newIndex}`);
         fetch(`/api/quiz/question?index=${newIndex}&quizSessionId=${userSessionId}`)
           .then(res => {
                if (!res.ok) { throw new Error(`Failed to fetch question ${newIndex + 1}`); }
                return res.json();
            })
           .then((questionData: CurrentQuestionDisplay) => {
              if (questionData.isFinished) { // Check if API returned finished state
                   setStage('finished');
              } else {
                  setCurrentQuestion(questionData);
                  setStage('showing_question');
              }
           })
           .catch(err => {
             console.error(err);
             toast({ title: 'Error loading question', description: err.message, variant: 'destructive' });
             setStage('error');
           })
           .finally(() => setIsLoading(false));
       }
       // Index 10: Fetch bonus question
       else if (newIndex === TOTAL_STANDARD_QUESTIONS) {
          console.log(`Fetching bonus question (index ${newIndex})`);
          fetch(`/api/quiz/question?index=${newIndex}&quizSessionId=${userSessionId}`)
             .then(res => {
                 if (!res.ok) { throw new Error(`Failed to fetch bonus question`); }
                 return res.json();
             })
             .then((questionData: CurrentQuestionDisplay) => {
                 if (questionData.isFinished) { // Handle case where bonus was skipped and quiz ended
                      setStage('finished');
                 } else if (questionData.isBonusQuestion) {
                     setCurrentQuestion(questionData);
                     setStage('showing_bonus');
                 } else {
                     // Should not happen if API is correct
                     console.error("Expected bonus question data but got something else:", questionData);
                     setStage('error');
                 }
             })
             .catch(err => {
                 console.error(err);
                 toast({ title: 'Error loading bonus question', description: err.message, variant: 'destructive' });
                 setStage('error');
             })
             .finally(() => setIsLoading(false));
       }
        // Index > 10: Quiz finished state (should normally transition via !isActive)
        else if (newIndex > TOTAL_STANDARD_QUESTIONS) {
            console.log(`Index ${newIndex} indicates quiz finished.`);
            setStage('finished');
            setIsLoading(false);
        }

    }
     // No change in index, but maybe quiz became inactive? Handled above.

  }, [quizState, userInfo, stage, toast]); // Add stage to dependencies


  // --- Event Handlers ---

  const handleJoinQuiz = async () => {
    // No name input needed
    setIsLoading(true);
    setStage('joining');
    try {
      const res = await fetch('/api/user/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No body needed for anonymous join
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to join quiz');
      }

      // data should contain { userId, quizSessionId }
      setUserInfo({ userId: data.userId, quizSessionId: data.quizSessionId });
      toast({ title: `Joined Quiz Anonymously!` });

       // Immediately fetch state after joining
       const stateRes = await fetch('/api/quiz/state');
       if (!stateRes.ok) { throw new Error('Failed to get initial quiz state'); }
       const stateData: QuizStateData = await stateRes.json();

        // Check if session matches (important if admin restarts quickly)
       if (stateData.quizSessionId && data.quizSessionId !== stateData.quizSessionId) {
            toast({ title: 'Quiz Restarted', description: 'The admin started a new quiz while you were joining. Please join again.', variant: 'destructive' });
            setUserInfo(null);
            setStage('initial');
       } else {
           setQuizState(stateData); // Set initial state
           if (!stateData.isQuizActive) {
               setStage('waiting_start');
           } else {
               // If quiz already started, trigger the state change effect
               currentQuestionIndexRef.current = -2; // Force update
               // Effect will fetch the correct question based on stateData.currentQuestionIndex
           }
       }

    } catch (error: any) {
      toast({ title: 'Error joining quiz', description: error.message, variant: 'destructive' });
       setStage('initial'); // Go back to initial stage on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (selectedOption === null || !userInfo || !quizState) return;
     // Only submit standard questions here
    if (quizState.currentQuestionIndex >= TOTAL_STANDARD_QUESTIONS) return;

    setIsLoading(true);
    setStage('submitted_answer');

    try {
       const payload = {
          userId: userInfo.userId,
          quizSessionId: userInfo.quizSessionId,
          questionIndex: quizState.currentQuestionIndex,
          selectedOptionIndex: selectedOption,
       };
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

       const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.message?.includes('rejected')) {
           // Handle specific rejection for wrong question index
            toast({ title: 'Submission Rejected', description: data.message, variant: 'destructive' });
             // Force state refresh to get the correct question
             currentQuestionIndexRef.current = -2; // Force state change effect
             await fetch('/api/quiz/state').then(r=>r.json()).then(setQuizState);
        } else {
             throw new Error(data.message || 'Failed to submit answer');
        }
      } else {
          // Success - No need to store result visually anymore
          // setLastAnswerResult({ isCorrect: data.isCorrect }); // Store the result
          // toast({ title: "Answer Submitted!" }); // Optionally show a simple toast
      }

    } catch (error: any) {
      toast({ title: 'Error submitting answer', description: error.message, variant: 'destructive' });
      // Don't automatically go back to showing_question, wait for state update
      // setStage('showing_question'); // Maybe show error state instead?
       setStage('submitted_answer'); // Stay here, show error via toast
    } finally {
      setIsLoading(false);
       // Stay in 'submitted_answer' stage
    }
  };

   const handleSubmitBonusAnswer = async () => {
      if (!userInfo || !quizState || quizState.currentQuestionIndex !== TOTAL_STANDARD_QUESTIONS) return;
      // No check for empty bonus answer, allow submitting empty

      setIsLoading(true);
      setStage('submitted_bonus'); // Move to submitted bonus state

      try {
         const payload = {
            userId: userInfo.userId,
            quizSessionId: userInfo.quizSessionId,
            questionIndex: TOTAL_STANDARD_QUESTIONS, // Explicitly set bonus index
            bonusAnswerText: bonusAnswerText.trim(),
         };
         const res = await fetch('/api/quiz/submit', { // Use the same submit endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
         });

         const data = await res.json();

         if (!res.ok) {
              if (res.status === 400 && data.message?.includes('rejected')) {
                 toast({ title: 'Submission Rejected', description: data.message, variant: 'destructive' });
                  // Force state refresh
                  currentQuestionIndexRef.current = -2;
                  await fetch('/api/quiz/state').then(r=>r.json()).then(setQuizState);
             } else {
                  throw new Error(data.message || 'Failed to submit bonus answer');
             }
         } else {
             toast({ title: 'Bonus Answer Submitted!' });
             // Stay in 'submitted_bonus' stage, waiting for admin to end or state to show finished
         }

      } catch (error: any) {
         toast({ title: 'Error submitting bonus answer', description: error.message, variant: 'destructive' });
          setStage('submitted_bonus'); // Stay here, show error via toast
      } finally {
         setIsLoading(false);
      }
   };

  // --- Render Functions for Stages ---

   const renderInitial = () => (
     <Card className="w-full max-w-md text-center">
       <CardHeader>
         <CardTitle>QuizTime Champions</CardTitle>
         <CardDescription>Ready to test your knowledge?</CardDescription>
       </CardHeader>
       <CardContent>
         <Button onClick={handleJoinQuiz} className="w-full" disabled={isLoading} size="lg">
           {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2"/>}
           Join Quiz Now
         </Button>
       </CardContent>
     </Card>
   );


  // renderJoining is implicit now, happens during handleJoinQuiz

  const renderWaiting = (message: string) => (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        {/* Removed user name */}
        <CardTitle>Welcome!</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
         <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="text-lg text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">(Waiting for updates...)</p>
      </CardContent>
    </Card>
  );

   const renderQuestion = () => {
      if (isLoading || !currentQuestion || currentQuestion.isBonusQuestion) {
         return renderWaiting("Loading question...");
      }
      const questionNumber = (quizState?.currentQuestionIndex ?? 0) + 1;

      return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Question {questionNumber}</CardTitle>
          <CardDescription className="text-lg pt-2">{currentQuestion.questionText}</CardDescription>
        </CardHeader>
        <CardContent>
           <RadioGroup
              value={selectedOption !== null ? selectedOption.toString() : undefined}
              onValueChange={(value) => setSelectedOption(parseInt(value, 10))}
              className="space-y-3"
              disabled={isLoading}
            >
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="text-base flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-accent hover:bg-yellow-500 text-accent-foreground"
            onClick={handleSubmitAnswer}
            disabled={isLoading || selectedOption === null}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/> }
            Submit Answer
          </Button>
        </CardFooter>
      </Card>
    );
  };

 // Updated renderSubmittedAnswer: Remove correct/incorrect icons and text
 const renderSubmittedAnswer = () => (
     <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Answer Submitted!</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
         {/* Removed icon display */}
         {/* {lastAnswerResult ? (
              lastAnswerResult.isCorrect ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500" />
              )
            ) : <Loader2 className="h-12 w-12 animate-spin text-primary" />
         } */}
         <p className="text-muted-foreground">Waiting for the next question...</p>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
 );

  const renderBonusQuestion = () => {
     if (isLoading || !currentQuestion || !currentQuestion.isBonusQuestion) {
         return renderWaiting("Loading bonus question...");
      }

     return (
        <Card className="w-full max-w-xl">
         <CardHeader>
           <CardTitle>Bonus Question!</CardTitle>
           <CardDescription className="text-lg pt-2">{currentQuestion.questionText}</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <Label htmlFor="bonusAnswer">Your Answer</Label>
            <Textarea
              id="bonusAnswer"
              value={bonusAnswerText}
              onChange={(e) => setBonusAnswerText(e.target.value)}
              placeholder="Type your answer here..."
              rows={4}
              disabled={isLoading}
            />
         </CardContent>
         <CardFooter>
           <Button
             className="w-full"
             onClick={handleSubmitBonusAnswer}
             disabled={isLoading} // Allow submitting empty answer
            >
             {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
             Submit Bonus Answer
           </Button>
         </CardFooter>
       </Card>
     );
  };

 const renderSubmittedBonus = () => (
     <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Bonus Answer Submitted!</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
         <CheckCircle className="h-12 w-12 text-primary" />
         <p className="text-muted-foreground">Waiting for the quiz to end...</p>
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
 );


  const renderFinished = () => (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Quiz Finished!</CardTitle>
        {/* Removed user name */}
        <CardDescription>Thanks for playing.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col space-y-4">
         <p className="text-lg mb-4">Check out the final scores and stats!</p>
         <div className="flex justify-center gap-4">
             <Button onClick={() => window.location.href = '/scores'} variant="default">View Leaderboard</Button>
             <Button onClick={() => window.location.href = '/stats'} variant="secondary">View Stats</Button>
         </div>
         <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Play Again?</Button>
      </CardContent>
    </Card>
  );

   const renderError = () => (
    <Card className="w-full max-w-md text-center border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">An Error Occurred</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
         <p className="text-destructive-foreground bg-destructive p-3 rounded-md mb-4">
             {userInfo?.quizSessionId && quizState?.quizSessionId && userInfo.quizSessionId !== quizState.quizSessionId
                ? 'You seem to be in the wrong quiz session. Please join again.'
                : 'Something went wrong. Please try refreshing or joining again.'}
         </p>
         <Button onClick={() => window.location.reload()} variant="destructive">Refresh Page</Button>
         <Button onClick={() => { setUserInfo(null); setStage('initial'); }} variant="outline" className="ml-4">Join Again</Button>
      </CardContent>
    </Card>
  );


  // --- Main Render Switch ---
  const renderCurrentStage = () => {
    switch (stage) {
      case 'initial':
           return renderInitial();
      case 'joining': // Show loading while joining
           return renderWaiting("Joining quiz...");
      case 'waiting_start':
        return renderWaiting('Waiting for the Admin to start the quiz...');
      case 'showing_question':
        return renderQuestion();
      case 'submitted_answer':
         return renderSubmittedAnswer();
      case 'showing_bonus':
         return renderBonusQuestion();
      case 'submitted_bonus':
         return renderSubmittedBonus();
      case 'finished':
         return renderFinished();
       case 'error':
          return renderError();
      default:
        return renderInitial(); // Default to initial join screen
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {renderCurrentStage()}
    </div>
  );
}
