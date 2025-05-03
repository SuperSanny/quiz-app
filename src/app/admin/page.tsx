'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { QuizStateData } from '@/types';
import { Loader2, Play, SkipForward } from 'lucide-react';

const POLLING_INTERVAL = 3000; // Poll quiz state every 3 seconds

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quizState, setQuizState] = useState<QuizStateData | null>(null);
  const { toast } = useToast();

   // --- Fetch Quiz State Periodically ---
  useEffect(() => {
    if (!isAuthenticated) return; // Don't poll if not authenticated

    const fetchQuizState = async () => {
      try {
        const res = await fetch('/api/quiz/state');
        if (!res.ok) {
          // Don't show error toast on every poll failure, maybe log it
          console.error(`Failed to fetch quiz state: ${res.status}`);
          return; // Exit quietly on poll failure
        }
        const data: QuizStateData = await res.json();
        setQuizState(data);
      } catch (error) {
        console.error('Error fetching quiz state:', error);
         // Don't show toast on network errors during polling
      }
    };

    fetchQuizState(); // Initial fetch
    const intervalId = setInterval(fetchQuizState, POLLING_INTERVAL);

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [isAuthenticated]); // Re-run effect when authentication status changes


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // In a real app, verify password against backend/env var
    // For this example, we'll compare against a client-side known value (less secure)
    // A better approach: Send password to a dedicated API endpoint for verification.
    // For simplicity now, we assume the ADMIN_PASSWORD env var is somehow accessible or compared here.
    // This is NOT secure for production.
    const expectedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'password'; // Use NEXT_PUBLIC_ for client-side access or fetch from backend

    if (password === expectedPassword) {
      setIsAuthenticated(true);
      toast({ title: 'Authentication successful' });
    } else {
      toast({ title: 'Authentication failed', variant: 'destructive' });
      setPassword(''); // Clear password field
    }
    setIsLoading(false);
  };

  const handleStartQuiz = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`, // Send password for verification
        },
        // body: JSON.stringify({ password }), // Alternatively send in body
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to start quiz');
      }

      toast({ title: 'Quiz Started!', description: `Session ID: ${data.quizSessionId}` });
      // Manually update local state after successful start
      setQuizState({ isQuizActive: true, currentQuestionIndex: 0, quizSessionId: data.quizSessionId });

    } catch (error: any) {
      toast({ title: 'Error starting quiz', description: error.message, variant: 'destructive' });
       // Re-fetch state on error to ensure consistency
       fetch('/api/quiz/state').then(res => res.json()).then(setQuizState).catch(console.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/next', {
        method: 'POST',
         headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`, // Send password for verification
        },
         // body: JSON.stringify({ password }), // Alternatively send in body
      });

       const data = await res.json();

      if (!res.ok) {
         throw new Error(data.message || 'Failed to advance question');
      }

      toast({ title: 'Question Advanced', description: `Moved to index ${data.newIndex}` });
       // Manually update local state after successful advancement
       if (quizState) {
            setQuizState({ ...quizState, currentQuestionIndex: data.newIndex });
        }


    } catch (error: any) {
      toast({ title: 'Error advancing question', description: error.message, variant: 'destructive' });
      // Re-fetch state on error
      fetch('/api/quiz/state').then(res => res.json()).then(setQuizState).catch(console.error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Logic ---

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Enter the admin password to access the control panel.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

   // Determine button states based on quizState
   const canStart = !quizState?.isQuizActive;
   // Can advance if quiz is active AND current index is valid for questions (0-9) or starting (-1)
   const canAdvance = quizState?.isQuizActive && quizState.currentQuestionIndex >= -1 && quizState.currentQuestionIndex < 10; // 10 questions total (0-9) + feedback (10)

   let statusMessage = "Loading quiz state...";
   if (quizState) {
      if (!quizState.isQuizActive && quizState.currentQuestionIndex === -1) {
         statusMessage = "Quiz has not started.";
      } else if (quizState.isQuizActive) {
        if (quizState.currentQuestionIndex >= 0 && quizState.currentQuestionIndex < 10) {
           statusMessage = `Quiz active. Currently on question ${quizState.currentQuestionIndex + 1} of 10.`;
        } else if (quizState.currentQuestionIndex === 10) {
           statusMessage = "Quiz active. Currently on the feedback stage.";
        } else {
             statusMessage = `Quiz active. Invalid state (Index: ${quizState.currentQuestionIndex}).`;
        }
      } else {
         // Quiz finished previously
         statusMessage = `Quiz finished (Session: ${quizState.quizSessionId || 'N/A'}). Press Start Quiz to begin a new one.`;
      }
   }


  return (
    <div className="container mx-auto p-4 py-8">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Admin Control Panel</CardTitle>
           <CardDescription>
            Session ID: {quizState?.quizSessionId || 'N/A'} <br />
            Status: {statusMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
          <Button
            onClick={handleStartQuiz}
            disabled={isLoading || !canStart}
            variant="default"
             size="lg"
             className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading && canStart ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2" />}
            Start Quiz
          </Button>
          <Button
            onClick={handleNextQuestion}
            disabled={isLoading || !canAdvance}
            variant="accent"
            size="lg"
            className="bg-accent hover:bg-yellow-500 text-accent-foreground"
          >
            {isLoading && canAdvance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2" />}
             {quizState?.currentQuestionIndex === 9 ? "Go to Feedback" : "Next Question"}
          </Button>
        </CardContent>
         <CardFooter>
             <p className="text-xs text-muted-foreground">
                 Use this panel to control the flow of the quiz for all participants.
                 Quiz state updates automatically every {POLLING_INTERVAL / 1000} seconds.
             </p>
         </CardFooter>
      </Card>
    </div>
  );
}
