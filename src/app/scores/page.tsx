
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, User } from 'lucide-react'; // Added User icon
import type { ScoreData } from '@/types';

const SCORE_POLL_INTERVAL = 1000; // Poll scores every 1 second

export default function ScoresPage() {
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isActive = true; // Flag to prevent state updates after unmount

    const fetchScores = async () => {
      try {
        const res = await fetch('/api/quiz/scores', { cache: 'no-store' }); // Ensure no caching
        if (!res.ok) {
          throw new Error(`Failed to fetch scores: ${res.status}`);
        }
        const data: ScoreData[] = await res.json();

        if (isActive) {
          setScores(data);
          setError(null); // Clear error on successful fetch
          setLastUpdated(new Date()); // Record update time
        }
      } catch (err: any) {
        console.error('Error fetching scores:', err);
         if (isActive) {
            setError('Could not load scores. Retrying...');
         }
      } finally {
         if (isActive) {
            setIsLoading(false);
         }
      }
    };

    fetchScores(); // Initial fetch
    const intervalId = setInterval(fetchScores, SCORE_POLL_INTERVAL);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, []); // Empty dependency array

  const getRankIcon = (rank: number | undefined) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500 inline-block mr-1" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400 inline-block mr-1" />;
    if (rank === 3) return <Award className="h-5 w-5 text-orange-400 inline-block mr-1" />;
    return <span className="inline-block w-5 mr-1 text-center font-mono">{rank || '-'}</span>;
  };

   const renderSkeletons = (count = 5) => (
        Array.from({ length: count }).map((_, index) => (
          <TableRow key={`skeleton-${index}`}>
            <TableCell className="w-16"><Skeleton className="h-5 w-8" /></TableCell>
            <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
          </TableRow>
        ))
    );

    // Function to partially anonymize userId
    const anonymizeUserId = (userId: string) => {
        if (!userId || userId.length < 6) return 'User ???'; // Handle short/invalid IDs
        return `User ${userId.substring(0, 3)}...${userId.substring(userId.length - 3)}`;
    };

  return (
    <div className="container mx-auto p-4 py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Leaderboard</CardTitle>
          <CardDescription>
            Live scores from the current quiz session. Participants are anonymous.
            {lastUpdated && (
                 <span className="block text-xs text-muted-foreground mt-1">
                     Last updated: {lastUpdated.toLocaleTimeString()}
                 </span>
            )}
          </CardDescription>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {isLoading ? (
                 renderSkeletons()
               ) : scores.length === 0 && !error ? (
                 <TableRow>
                   <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                     No participants yet, or the quiz hasn't started. Scores will appear here live.
                   </TableCell>
                 </TableRow>
               ) : (
                scores.map((scoreData) => (
                  <TableRow key={scoreData.userId} className={ // Use userId as key
                    `
                    ${scoreData.rank === 1 ? 'bg-yellow-100/50 dark:bg-yellow-900/30 font-semibold' : ''}
                    ${scoreData.rank === 2 ? 'bg-gray-100/50 dark:bg-gray-800/30' : ''}
                    ${scoreData.rank === 3 ? 'bg-orange-100/50 dark:bg-orange-900/30' : ''}
                    `
                  }>
                    <TableCell className="w-16 font-medium">
                      {getRankIcon(scoreData.rank)}
                    </TableCell>
                    <TableCell className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                        {anonymizeUserId(scoreData.userId)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{scoreData.score}</TableCell>
                  </TableRow>
                ))
              )}
               {scores.length === 0 && error && !isLoading && (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center text-destructive py-8">
                            Error loading scores. Retrying automatically...
                        </TableCell>
                    </TableRow>
               )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
       {/* Add Link to Stats Page */}
       <div className="text-center mt-4">
          <a href="/stats" className="text-sm text-primary hover:underline">
            View Question Stats
          </a>
        </div>
    </div>
  );
}
