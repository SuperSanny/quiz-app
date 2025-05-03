
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress'; // Import Progress component
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { QuestionStats } from '@/types'; // Ensure this matches the updated type
import { CheckCircle, Users } from 'lucide-react'; // Removed XCircle, TrendingDown

const STATS_POLL_INTERVAL = 5000; // Poll stats every 5 seconds

// Helper function to generate colors for the bar chart (using correct percentage)
const getBarColor = (percentage: number) => {
  if (percentage >= 75) return 'hsl(var(--chart-2))'; // Greenish
  if (percentage >= 50) return 'hsl(var(--chart-4))'; // Yellowish
  return 'hsl(var(--chart-1))'; // Reddish
};

export default function StatsPage() {
  const [stats, setStats] = useState<QuestionStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/quiz/stats', { cache: 'no-store' });
        if (!res.ok) {
           // Try to get error message from response body
          let errorMsg = `Failed to fetch stats: ${res.status}`;
          try {
            const errorData = await res.json();
            errorMsg = errorData.message || errorMsg;
          } catch (jsonError) {
            // Ignore if response is not JSON
          }
          throw new Error(errorMsg);
        }
        const data: QuestionStats[] = await res.json();

        if (isActive) {
          setStats(data);
          setError(null);
          setLastUpdated(new Date());
        }
      } catch (err: any) {
        console.error('Error fetching stats:', err);
        if (isActive) {
          setError(`Could not load statistics: ${err.message}. Retrying...`);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchStats(); // Initial fetch
    const intervalId = setInterval(fetchStats, STATS_POLL_INTERVAL);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, []);

  const renderSkeletons = (count = 5) => (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={`skeleton-${index}`} className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/4 mt-1" />
          </CardHeader>
          <CardContent>
            {/* Simulate the new structure (only correct) */}
            <Skeleton className="h-4 w-full mb-2" />
             <div className="flex justify-between text-sm mt-2">
                <Skeleton className="h-4 w-1/4" />
              </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Format data for the chart (still based on correct percentage for coloring)
   const chartData = stats.map(stat => ({
     name: `Q${stat.questionIndex + 1}`,
     percentage: stat.totalAttempts > 0 ? stat.correctPercentage : 0,
     // Add other data for tooltip if needed
     totalAttempts: stat.totalAttempts,
     questionText: stat.questionText,
   }));


  return (
    <div className="container mx-auto p-4 py-8">
      <Card className="max-w-4xl mx-auto shadow-lg mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Quiz Statistics</CardTitle>
          <CardDescription>
            Correct answer percentage for each question in the last quiz session.
            {lastUpdated && (
              <span className="block text-xs text-muted-foreground mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </CardDescription>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </CardHeader>
         {/* Bar Chart Section */}
        <CardContent>
            {isLoading ? (
                <Skeleton className="h-64 w-full" />
             ) : stats.length === 0 && !error ? (
                 <p className="text-center text-muted-foreground py-8">No statistics available yet. Finish a quiz first.</p>
             ) : !error ? (
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <BarChart
                            data={chartData}
                            margin={{ top: 5, right: 10, left: -20, bottom: 5 }} // Adjust margins
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--foreground))" fontSize={12} unit="%" domain={[0, 100]}/>
                            <Tooltip
                                contentStyle={{
                                    background: 'hsl(var(--background))',
                                    borderColor: 'hsl(var(--border))',
                                    borderRadius: 'var(--radius)',
                                }}
                                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                formatter={(value: number, name, props) => {
                                    // Custom formatter to show correct percentage and attempts
                                    const { payload } = props;
                                    if (payload) {
                                        return [
                                            `Correct: ${payload.percentage.toFixed(1)}%`,
                                            `Attempts: ${payload.totalAttempts}`,
                                            `${payload.questionText}`, // Show question text in tooltip
                                        ];
                                    }
                                    return [`${value.toFixed(1)}%`, name];
                                }}
                                labelFormatter={(label) => `Question ${label.substring(1)}`} // Format label as "Question X"
                            />
                            <Bar dataKey="percentage" radius={[4, 4, 0, 0]} /* Top rounded corners */ >
                                 {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : null}
             {stats.length === 0 && error && !isLoading && (
                 <p className="text-center text-destructive py-8">Error loading statistics. Retrying automatically...</p>
             )}
        </CardContent>
      </Card>

      {/* Detailed Question Stats */}
       <h2 className="text-2xl font-semibold mb-4 text-center">Detailed Breakdown</h2>
      {isLoading ? (
        renderSkeletons()
      ) : stats.length === 0 && !error ? (
         <p className="text-center text-muted-foreground py-8">No detailed stats to display.</p>
      ) : (
        <div className="space-y-4">
          {stats.map((stat) => (
            <Card key={stat.questionIndex}>
              <CardHeader>
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>Question {stat.questionIndex + 1}</span>
                   <span className="text-sm font-normal text-muted-foreground flex items-center">
                       <Users className="h-4 w-4 mr-1"/> {stat.totalAttempts} Attempts
                   </span>
                </CardTitle>
                <CardDescription className="pt-1">{stat.questionText}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Progress Bar for Correct Percentage */}
                <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-green-600 flex items-center">
                            <CheckCircle className="h-4 w-4 mr-1"/> Correct
                        </span>
                        <span className={`text-lg font-bold text-green-600`}>
                           {stat.correctPercentage.toFixed(1)}%
                        </span>
                    </div>
                    <Progress value={stat.correctPercentage} className="h-2 bg-green-100 [&>div]:bg-green-500" aria-label={`${stat.correctPercentage.toFixed(1)}% Correct`} />
                     <span className="text-xs text-muted-foreground">{stat.correctCount} correct answers</span>
                </div>

                 {/* Removed Incorrect Percentage Block */}

              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Add Link back to Scores Page */}
       <div className="text-center mt-6">
          <a href="/scores" className="text-sm text-primary hover:underline">
            View Leaderboard
          </a>
        </div>
    </div>
  );
}
