'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award } from 'lucide-react'; // Icons for ranks
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
            // Avoid flooding with errors, maybe show a persistent error message
            setError('Could not load scores. Retrying...');
         }
      } finally {
         if (isActive) {
            setIsLoading(false); // Set loading to false after first attempt (success or fail)
         }
      }
    };

    fetchScores(); // Initial fetch
    const intervalId = setInterval(fetchScores, SCORE_POLL_INTERVAL);

    return () => {
      isActive = false; // Set flag on cleanup
      clearInterval(intervalId);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const getRankIcon = (rank: number | undefined) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500 inline-block mr-1" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400 inline-block mr-1" />;
    if (rank === 3) return <Award className="h-5 w-5 text-orange-400 inline-block mr-1" />;
    return <span className="inline-block w-5 mr-1 text-center">{rank || '-'}</span>; // Display rank number or '-'
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

  return (
    <div className="container mx-auto p-4 py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Leaderboard</CardTitle>
          <CardDescription>
            Live scores from the current quiz session. Updates automatically.
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
                <TableHead>Name</TableHead>
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
                  <TableRow key={scoreData.userName} className={
                    `
                    ${scoreData.rank === 1 ? 'bg-yellow-100/50 dark:bg-yellow-900/30 font-semibold' : ''}
                    ${scoreData.rank === 2 ? 'bg-gray-100/50 dark:bg-gray-800/30' : ''}
                    ${scoreData.rank === 3 ? 'bg-orange-100/50 dark:bg-orange-900/30' : ''}
                    `
                  }>
                    <TableCell className="w-16 font-medium">
                      {getRankIcon(scoreData.rank)}
                    </TableCell>
                    <TableCell>{scoreData.userName}</TableCell>
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
    </div>
  );
}
