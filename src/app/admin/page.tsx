
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { QuizStateData } from '@/types';
import { Loader2, Play, SkipForward, PowerOff } from 'lucide-react'; // Added PowerOff

const POLLING_INTERVAL = 3000; // Poll quiz state every 3 seconds

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'start' | 'next' | 'end' | null>(null); // Track which action is loading
  const [quizState, setQuizState] = useState<QuizStateData | null>(null);
  const { toast } = useToast();

  // --- Fetch Quiz State Periodically ---
  useEffect(() => {
    if (!isAuthenticated) return; // Don't poll if not authenticated

    let isMounted = true; // Track component mount status

    const fetchQuizState = async () => {
      try {
        const res = await fetch('/api/quiz/state');
        if (!res.ok) {
          console.error(`Failed to fetch quiz state: ${res.status}`);
           if (res.status === 401 && isMounted) { // Handle potential auth issues during polling
               toast({ title: 'Session Expired?', description: 'Please re-login.', variant: 'destructive' });
               setIsAuthenticated(false); // Force re-login
           }
          return;
        }
        const data: QuizStateData = await res.json();
        if (isMounted) {
             setQuizState(data);
        }
      } catch (error) {
        console.error('Error fetching quiz state:', error);
         // Don't show toast on network errors during polling unless needed
      }
    };

    fetchQuizState(); // Initial fetch
    const intervalId = setInterval(fetchQuizState, POLLING_INTERVAL);

    return () => {
        isMounted = false; // Set to false on cleanup
        clearInterval(intervalId);
    }; // Cleanup interval on unmount
  }, [isAuthenticated, toast]); // Re-run effect when authentication status changes


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); // Use general isLoading for login
    // IMPORTANT: NEVER use NEXT_PUBLIC_ for sensitive data like passwords.
    // This example is simplified. In production, always verify on the backend.
    // fetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) })...
    const expectedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'password'; // Using NEXT_PUBLIC_ only for demo simplicity

    if (password === expectedPassword) {
      setIsAuthenticated(true);
      toast({ title: 'Authentication successful' });
    } else {
      toast({ title: 'Authentication failed', variant: 'destructive' });
      setPassword(''); // Clear password field
    }
    setIsLoading(false);
  };

   // Generic action handler
   const handleAdminAction = async (action: 'start' | 'next' | 'end') => {
    setActionLoading(action); // Set loading specific to this action
    try {
      const res = await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`, // Send password for verification
        },
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error statuses if needed
         if (res.status === 401) {
              toast({ title: 'Authentication Failed', description: 'Your admin password might be incorrect or expired.', variant: 'destructive' });
               setIsAuthenticated(false); // Force re-login on auth failure
               return; // Stop further processing
         }
        throw new Error(data.message || `Failed to ${action} quiz`);
      }

      // Success messages based on action
      let toastTitle = '';
      let toastDescription = '';
      switch (action) {
          case 'start':
              toastTitle = 'Quiz Started!';
              toastDescription = `Session ID: ${data.quizSessionId}`;
              // Manually update local state immediately for better UX
              setQuizState({ isQuizActive: true, currentQuestionIndex: 0, quizSessionId: data.quizSessionId });
              break;
          case 'next':
              toastTitle = 'Question Advanced';
               // Calculate the display question number (index + 1), or 'Feedback'
                const displayNum = data.newIndex < 10 ? data.newIndex + 1 : 'Feedback';
              toastDescription = `Moved to ${displayNum}`;
              if (quizState) {
                  setQuizState({ ...quizState, currentQuestionIndex: data.newIndex });
              }
              break;
          case 'end':
              toastTitle = 'Quiz Ended';
              toastDescription = `Session ${data.quizSessionId || quizState?.quizSessionId || 'N/A'} is now inactive.`;
               if (quizState) {
                  setQuizState({ ...quizState, isQuizActive: false }); // Update local state
              } else {
                   setQuizState({ isQuizActive: false, currentQuestionIndex: -1 }); // Default if no prior state
              }
              break;
      }

      toast({ title: toastTitle, description: toastDescription });


    } catch (error: any) {
       console.error(`Error performing admin action (${action}):`, error);
      toast({ title: `Error ${action === 'start' ? 'starting' : action === 'next' ? 'advancing' : 'ending'} quiz`, description: error.message, variant: 'destructive' });
      // Optionally re-fetch state on error to ensure consistency, but polling might cover this
       // fetch('/api/quiz/state').then(res => res.json()).then(setQuizState).catch(console.error);
    } finally {
      setActionLoading(null); // Clear loading state for this action
    }
  };


  // --- Render Logic ---

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-sm shadow-lg">
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
   const isBusy = !!actionLoading; // True if any action is loading
   const canStart = !isBusy && !quizState?.isQuizActive;
   const canAdvance = !isBusy && quizState?.isQuizActive && quizState.currentQuestionIndex >= 0 && quizState.currentQuestionIndex < 10; // Assumes 10 questions (0-9), index 10 is feedback
   const canEnd = !isBusy && quizState?.isQuizActive;

   // Refined Status Messages
    let statusMessage = "Loading quiz state...";
    let currentStepDisplay = "";
    if (quizState) {
        if (quizState.isQuizActive) {
            statusMessage = "Quiz active.";
            const totalQuestions = 10; // Assuming 10 questions
            const currentIndex = quizState.currentQuestionIndex;
            if (currentIndex >= 0 && currentIndex < totalQuestions) {
                currentStepDisplay = `Question ${currentIndex + 1} of ${totalQuestions}`;
            } else if (currentIndex === totalQuestions) {
                currentStepDisplay = "Feedback Stage";
            } else if (currentIndex === -1) {
                 // This case should ideally not happen if quiz is active, but handle defensively
                 statusMessage = "Quiz active, but waiting for first question (Index: -1). Press Next Question.";
                 currentStepDisplay = "Pre-Start";
            }
             else {
                statusMessage = `Quiz active. Unexpected state (Index: ${currentIndex}).`;
            }
        } else {
            // Quiz is not active
            if (quizState.currentQuestionIndex === -1 && !quizState.quizSessionId) {
                 statusMessage = "No quiz has been started yet.";
            } else if (quizState.quizSessionId) {
                 statusMessage = `Quiz finished or not started. Last Session ID: ${quizState.quizSessionId}.`;
                 currentStepDisplay = "Inactive";
            } else {
                 statusMessage = "Quiz is inactive."; // Fallback
            }
        }
    }


  return (
    <div className="container mx-auto p-4 py-8">
      <Card className="max-w-lg mx-auto shadow-xl">
        <CardHeader>
          <CardTitle>Admin Control Panel</CardTitle>
           <CardDescription>
            <span className="block font-medium">Session ID:</span> {quizState?.quizSessionId || 'N/A'} <br />
            <span className="block font-medium mt-1">Status:</span> {statusMessage} {currentStepDisplay && `(${currentStepDisplay})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
          {/* Start Quiz Button */}
          <Button
            onClick={() => handleAdminAction('start')}
            disabled={!canStart}
            variant="default"
             size="lg"
             className="bg-green-600 hover:bg-green-700 text-white"
          >
            {actionLoading === 'start' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2" />}
            Start New Quiz
          </Button>

          {/* Next Question Button */}
          <Button
            onClick={() => handleAdminAction('next')}
            disabled={!canAdvance}
            variant="accent"
            size="lg"
            // className="bg-accent hover:bg-yellow-500 text-accent-foreground" // Already defined in globals?
          >
            {actionLoading === 'next' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2" />}
             {quizState?.currentQuestionIndex === 9 ? "Go to Feedback" : "Next Question"}
          </Button>

           {/* End Quiz Button */}
          <Button
            onClick={() => handleAdminAction('end')}
            disabled={!canEnd}
            variant="destructive" // Use destructive style for ending
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white" // Explicit destructive colors
          >
            {actionLoading === 'end' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PowerOff className="mr-2" />}
             End Current Quiz
          </Button>

        </CardContent>
         <CardFooter>
             <p className="text-xs text-muted-foreground">
                 Use this panel to control the flow of the quiz for all participants.
                 Quiz state updates automatically every {POLLING_INTERVAL / 1000} seconds. Ending a quiz makes it inactive.
             </p>
         </CardFooter>
      </Card>
    </div>
  );
}
