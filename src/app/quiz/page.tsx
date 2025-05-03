'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Question, QuizStateData, UserInfo } from '@/types';
import { Loader2, CheckCircle, XCircle, Send } from 'lucide-react';

const QUIZ_STATE_POLL_INTERVAL = 2000; // Poll quiz state every 2 seconds

type QuizStage = 'joining' | 'waiting_start' | 'showing_question' | 'submitted_answer' | 'feedback' | 'finished' | 'error';

interface CurrentQuestion extends Omit<Question, 'correctAnswerIndex'> {
 // We don't need correctAnswerIndex on the client for display
 isFeedbackStage?: boolean; // Flag for the feedback question
}


export default function QuizPage() {
  const [userName, setUserName] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null); // Stores userId, userName, quizSessionId
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<QuizStage>('joining');
  const [quizState, setQuizState] = useState<QuizStateData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [lastAnswerResult, setLastAnswerResult] = useState<{ isCorrect: boolean } | null>(null);
  const { toast } = useToast();

  const currentQuestionIndexRef = useRef<number>(-1); // Ref to track the last processed question index

   // --- Effect for Polling Quiz State ---
   useEffect(() => {
    if (!userInfo) return; // Don't poll if user hasn't joined

    let isActive = true; // Flag to prevent state updates after unmount
    const intervalId = setInterval(async () => {
      if (!isActive) return;
      try {
        const res = await fetch('/api/quiz/state');
        if (!res.ok) {
          console.error(`Failed to fetch quiz state: ${res.status}`);
           if (res.status === 404) {
              // Quiz might have ended or session invalid
              setStage('error');
              toast({ title: 'Error', description: 'Quiz session not found or ended.', variant: 'destructive'});
              clearInterval(intervalId); // Stop polling on critical error
           }
          return;
        }
        const data: QuizStateData = await res.json();

        if (isActive) { // Check flag before setting state
            setQuizState(data);
        }

      } catch (error) {
        console.error('Polling error:', error);
         // Maybe show a less intrusive connection error indicator
      }
    }, QUIZ_STATE_POLL_INTERVAL);

     return () => {
        isActive = false; // Set flag on cleanup
        clearInterval(intervalId);
     };
  }, [userInfo, toast]); // Depend on userInfo


  // --- Effect for Handling Quiz State Changes ---
   useEffect(() => {
    if (!quizState || !userInfo) return; // Need state and user info

    const newIndex = quizState.currentQuestionIndex;
    const isActive = quizState.isQuizActive;

    // Check if the quizSessionId matches the user's session
    if (quizState.quizSessionId && userInfo.quizSessionId !== quizState.quizSessionId) {
        setStage('error');
        toast({ title: 'Session Mismatch', description: 'You joined a different quiz session. Please rejoin.', variant: 'destructive' });
        // Reset user info to force rejoin
        setUserInfo(null);
        setUserName('');
        currentQuestionIndexRef.current = -1;
        setQuizState(null);
        setCurrentQuestion(null);
        setStage('joining');
        return;
    }


    // If quiz is not active yet
    if (!isActive && newIndex === -1 && stage !== 'joining') {
      setStage('waiting_start');
      currentQuestionIndexRef.current = -1; // Reset ref
      return;
    }

    // If quiz is active and index has changed from the last processed index
     if (isActive && newIndex !== currentQuestionIndexRef.current) {
       currentQuestionIndexRef.current = newIndex; // Update ref immediately
       setLastAnswerResult(null); // Clear previous answer result
       setSelectedOption(null); // Reset selection
       setCurrentQuestion(null); // Clear old question while loading new one
       setIsLoading(true); // Show loading state

       // Index 0-9: Fetch regular question
       if (newIndex >= 0 && newIndex < 10) {
         fetch(`/api/quiz/question?index=${newIndex}&quizSessionId=${userInfo.quizSessionId}`)
           .then(res => {
                if (!res.ok) { throw new Error(`Failed to fetch question ${newIndex + 1}`); }
                return res.json();
            })
           .then((questionData: CurrentQuestion) => {
              setCurrentQuestion(questionData);
              setStage('showing_question');
           })
           .catch(err => {
             console.error(err);
             toast({ title: 'Error loading question', description: err.message, variant: 'destructive' });
             setStage('error');
           })
           .finally(() => setIsLoading(false));
       }
       // Index 10: Go to feedback stage
       else if (newIndex === 10) {
          setStage('feedback');
          setIsLoading(false);
       }
        // Index > 10 or other unexpected index while active (could mean finished)
        else if (newIndex > 10) {
            setStage('finished');
            setIsLoading(false);
        } else { // newIndex is -1 but quiz is active (shouldn't normally happen, but handle defensively)
             setStage('waiting_start'); // Revert to waiting if index goes back to -1 unexpectedly
             setIsLoading(false);
        }

    } else if (!isActive && newIndex > -1) {
         // Quiz was active but now is not (likely finished after feedback)
         setStage('finished');
         currentQuestionIndexRef.current = newIndex; // Update ref to prevent re-triggering
    }

  }, [quizState, userInfo, stage, toast]); // Add stage to dependencies


  // --- Event Handlers ---

  const handleJoinQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setStage('joining'); // Ensure stage is correct during join attempt
    try {
      const res = await fetch('/api/user/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to join quiz');
      }

      // data should contain { userId, userName, quizSessionId }
      setUserInfo({ userId: data.userId, userName: data.userName, quizSessionId: data.quizSessionId });
      toast({ title: `Welcome, ${data.userName}!` });

       // Immediately fetch state after joining to determine next stage
       const stateRes = await fetch('/api/quiz/state');
       const stateData: QuizStateData = await stateRes.json();
        setQuizState(stateData); // Set initial state
        if (!stateData.isQuizActive) {
            setStage('waiting_start');
        } else {
             // If quiz already started, trigger the state change effect
             currentQuestionIndexRef.current = -2; // Force update by setting ref different from initial state index
             // The useEffect hook for quizState changes will handle fetching the question
        }


    } catch (error: any) {
      toast({ title: 'Error joining quiz', description: error.message, variant: 'destructive' });
       setStage('joining'); // Stay in joining stage on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (selectedOption === null || !userInfo || !quizState) return;

    setIsLoading(true);
    setStage('submitted_answer'); // Move to submitted state immediately

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
        // Handle specific conflict error (already submitted) differently
        if (res.status === 409) {
             toast({ title: 'Already Submitted', description: data.message || 'You already answered this question.' });
             // Optionally show the previous result if available
             // setLastAnswerResult({ isCorrect: data.isCorrect }); // Assuming API returns previous result
        } else {
            throw new Error(data.message || 'Failed to submit answer');
        }
      } else {
          // Success
          setLastAnswerResult({ isCorrect: data.isCorrect }); // Store the result
          // Toast is shown based on lastAnswerResult below
      }

    } catch (error: any) {
      toast({ title: 'Error submitting answer', description: error.message, variant: 'destructive' });
      setStage('showing_question'); // Go back to question on error to allow retry? Or show error state?
    } finally {
      setIsLoading(false);
       // Stay in 'submitted_answer' stage until admin moves to next question
    }
  };

   const handleSubmitFeedback = async () => {
      if (!feedbackText.trim() || !userInfo || !quizState) return;

      setIsLoading(true);
      try {
         const payload = {
            userId: userInfo.userId,
            quizSessionId: userInfo.quizSessionId,
            feedback: feedbackText.trim(),
         };
         const res = await fetch('/api/quiz/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
         });

         const data = await res.json();

         if (!res.ok) {
            throw new Error(data.message || 'Failed to submit feedback');
         }

         toast({ title: 'Feedback Submitted', description: 'Thank you for your feedback!' });
         setStage('finished'); // Move to finished stage after feedback

      } catch (error: any) {
         toast({ title: 'Error submitting feedback', description: error.message, variant: 'destructive' });
      } finally {
         setIsLoading(false);
      }
   };

  // --- Render Functions for Stages ---

  const renderJoining = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join QuizTime Champions</CardTitle>
        <CardDescription>Enter your name to participate.</CardDescription>
      </CardHeader>
      <form onSubmit={handleJoinQuiz}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g., Alex"
              required
              disabled={isLoading}
              maxLength={50} // Add a reasonable length limit
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Join Quiz
          </Button>
        </CardFooter>
      </form>
    </Card>
  );

  const renderWaiting = (message: string) => (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Welcome, {userInfo?.userName}!</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
         <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="text-lg text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">(Polling every {QUIZ_STATE_POLL_INTERVAL / 1000}s for updates)</p>
      </CardContent>
    </Card>
  );

   const renderQuestion = () => {
      if (isLoading || !currentQuestion) {
         return renderWaiting("Loading question...");
      }

      return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Question {quizState!.currentQuestionIndex + 1}</CardTitle>
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

 const renderSubmittedAnswer = () => (
     <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Answer Submitted!</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
         {lastAnswerResult ? (
              lastAnswerResult.isCorrect ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500" />
              )
            ) : <Loader2 className="h-12 w-12 animate-spin text-primary" /> // Show loader if result not yet received
         }
         <p className="text-lg text-muted-foreground">
             {lastAnswerResult ? (lastAnswerResult.isCorrect ? 'Correct!' : 'Incorrect!') : 'Processing...'}
         </p>
         <p className="text-muted-foreground">Waiting for the admin to move to the next question...</p>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
 );


 const renderFeedback = () => (
     <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Quiz Complete!</CardTitle>
        <CardDescription>Please provide your feedback on the quiz.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         <Label htmlFor="feedback">Your Feedback (Optional)</Label>
         <Textarea
           id="feedback"
           value={feedbackText}
           onChange={(e) => setFeedbackText(e.target.value)}
           placeholder="How was the quiz? Any suggestions?"
           rows={4}
           disabled={isLoading}
         />
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleSubmitFeedback}
          disabled={isLoading || !feedbackText.trim()} // Disable if no text or loading
         >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit Feedback
        </Button>
      </CardFooter>
    </Card>
 );

  const renderFinished = () => (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Quiz Finished!</CardTitle>
        <CardDescription>Thanks for playing, {userInfo?.userName}.</CardDescription>
      </CardHeader>
      <CardContent>
         <p className="text-lg mb-4">You can view the final scores on the leaderboard.</p>
         <Button onClick={() => window.location.href = '/scores'} variant="default">View Leaderboard</Button>
          <Button onClick={() => window.location.reload()} variant="outline" className="ml-4">Play Again?</Button>
      </CardContent>
    </Card>
  );

   const renderError = () => (
    <Card className="w-full max-w-md text-center border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">An Error Occurred</CardTitle>
      </CardHeader>
      <CardContent>
         <p className="text-destructive-foreground bg-destructive p-3 rounded-md mb-4">
             {quizState?.quizSessionId && userInfo?.quizSessionId !== quizState?.quizSessionId
                ? 'You seem to be in the wrong quiz session. Please rejoin.'
                : 'Something went wrong. Please try refreshing the page or rejoining the quiz.'}
         </p>
         <Button onClick={() => window.location.reload()} variant="destructive">Refresh Page</Button>
         {quizState?.quizSessionId && userInfo?.quizSessionId !== quizState?.quizSessionId && (
             <Button onClick={() => { setUserInfo(null); setUserName(''); setStage('joining'); }} variant="outline" className="ml-4">Rejoin Quiz</Button>
         )}
      </CardContent>
    </Card>
  );


  // --- Main Render Switch ---
  const renderCurrentStage = () => {
    switch (stage) {
      case 'joining':
        return renderJoining();
      case 'waiting_start':
        return renderWaiting('Waiting for the Admin to start the quiz...');
      case 'showing_question':
        return renderQuestion();
      case 'submitted_answer':
         return renderSubmittedAnswer();
      case 'feedback':
        return renderFeedback();
      case 'finished':
         return renderFinished();
       case 'error':
          return renderError();
      default:
        return renderJoining(); // Default to joining stage
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {renderCurrentStage()}
    </div>
  );
}
