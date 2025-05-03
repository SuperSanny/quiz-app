
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { useToast } from '@/hooks/use-toast';
import type { QuizStateData } from '@/types';
import { Loader2, Play, SkipForward, PowerOff, AlertTriangle, HelpCircle } from 'lucide-react'; // Added HelpCircle

const POLLING_INTERVAL = 3000; // Poll quiz state every 3 seconds
const TOTAL_STANDARD_QUESTIONS = 10; // Number of standard questions

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'start' | 'next' | 'end' | null>(null); // Track which action is loading
  const [quizState, setQuizState] = useState<QuizStateData | null>(null);
  const [bonusQuestionText, setBonusQuestionText] = useState(''); // State for bonus question
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

    const expectedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'password'; // **INSECURE - FOR LOCAL DEMO ONLY**

    if (password === expectedPassword) {
        setIsAuthenticated(true);
        toast({ title: 'Password accepted (Client-side check). Actions will verify on backend.' });
    } else {
      toast({ title: 'Authentication failed (Client-side check)', variant: 'destructive' });
      setPassword(''); // Clear password field
    }
    setIsLoading(false);
  };

   // Generic action handler
   const handleAdminAction = async (action: 'start' | 'next' | 'end') => {
    setActionLoading(action); // Set loading specific to this action
    try {
        let payload: any = {};
        if (action === 'start') {
            payload = { bonusQuestionText: bonusQuestionText.trim() };
        }

      const res = await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`,
        },
        body: action === 'start' ? JSON.stringify(payload) : undefined, // Add body only for start
      });

      const data = await res.json();

      if (!res.ok) {
         if (res.status === 401) {
              toast({ title: 'Authentication Failed (Backend)', description: 'Your admin password might be incorrect or expired.', variant: 'destructive' });
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
              toastDescription = `Session ID: ${data.quizSessionId}. Bonus Question: ${bonusQuestionText.trim() ? 'Included' : 'Skipped'}`;
              setQuizState({ isQuizActive: true, currentQuestionIndex: 0, quizSessionId: data.quizSessionId });
              break;
          case 'next':
              toastTitle = 'Question Advanced';
              // Check if advancing TO the bonus question stage
              const nextIndexDisplay = data.newIndex === TOTAL_STANDARD_QUESTIONS ? 'Bonus Question' : `Question ${data.newIndex + 1}`;
              toastDescription = `Moved to ${nextIndexDisplay}`;
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
              setBonusQuestionText(''); // Clear bonus question text on end
              break;
      }

      toast({ title: toastTitle, description: toastDescription });


    } catch (error: any) {
       console.error(`Error performing admin action (${action}):`, error);
      toast({ title: `Error ${action === 'start' ? 'starting' : action === 'next' ? 'advancing' : 'ending'} quiz`, description: error.message, variant: 'destructive' });
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
            <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-300">
                <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2"/>
                    <p className="font-bold">Security Notice</p>
                </div>
                <p className="text-sm mt-1">
                    For local demo, the password check is basic. In production, ensure `ADMIN_PASSWORD` is set securely on the server, not exposed publicly.
                </p>
            </div>
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
   // Can advance if active, index is valid (0 to TOTAL_STANDARD_QUESTIONS inclusive for bonus)
   const canAdvance = !isBusy && quizState?.isQuizActive && quizState.currentQuestionIndex >= 0 && quizState.currentQuestionIndex < TOTAL_STANDARD_QUESTIONS;
   const canEnd = !isBusy && quizState?.isQuizActive;

   // Refined Status Messages
    let statusMessage = "Loading quiz state...";
    let currentStepDisplay = "";
    if (quizState) {
        const currentIndex = quizState.currentQuestionIndex;
        if (quizState.isQuizActive) {
            statusMessage = "Quiz active.";
            if (currentIndex >= 0 && currentIndex < TOTAL_STANDARD_QUESTIONS) {
                currentStepDisplay = `Question ${currentIndex + 1} of ${TOTAL_STANDARD_QUESTIONS}`;
            } else if (currentIndex === TOTAL_STANDARD_QUESTIONS) {
                currentStepDisplay = "Bonus Question Stage";
            } else if (currentIndex === -1) {
                 statusMessage = "Quiz active, but waiting for first question. Press Start Quiz.";
                 currentStepDisplay = "Pre-Start";
            }
             else { // Index > TOTAL_STANDARD_QUESTIONS (should not happen if 'next' logic is correct)
                statusMessage = `Quiz active, but in unexpected state (Index: ${currentIndex}). Consider ending quiz.`;
            }
        } else {
            // Quiz is not active
            if (currentIndex === -1 && !quizState.quizSessionId) {
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
          {/* Bonus Question Input (Visible when quiz is inactive) */}
           {!quizState?.isQuizActive && (
              <div className="space-y-2">
                  <Label htmlFor="bonusQuestion" className="flex items-center">
                       <HelpCircle className="mr-2 h-4 w-4 text-muted-foreground"/>
                       Optional Bonus Question
                  </Label>
                  <Textarea
                      id="bonusQuestion"
                      placeholder="Enter a bonus question text here (shown after standard questions). Leave blank to skip."
                      value={bonusQuestionText}
                      onChange={(e) => setBonusQuestionText(e.target.value)}
                      rows={3}
                      disabled={isBusy}
                  />
              </div>
            )}

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
          >
            {actionLoading === 'next' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2" />}
             {quizState?.currentQuestionIndex === TOTAL_STANDARD_QUESTIONS - 1 ? "Go to Bonus Question" : "Next Question"}
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
                 Control the quiz flow. Bonus question is shown after question {TOTAL_STANDARD_QUESTIONS}.
                 Ending the quiz makes it inactive. State updates every {POLLING_INTERVAL / 1000}s.
             </p>
         </CardFooter>
      </Card>
    </div>
  );
}
