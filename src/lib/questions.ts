import fs from 'fs';
import path from 'path';
import type { Question } from '@/types';

// Path to the questions JSON file
const questionsFilePath = path.join(process.cwd(), 'questions.json');

// Function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
  }
  return shuffled;
}

// Function to get all questions
export function getAllQuestions(): Question[] {
  try {
    const fileContents = fs.readFileSync(questionsFilePath, 'utf8');
    const questions: Question[] = JSON.parse(fileContents);
    return questions;
  } catch (error) {
    console.error("Error reading or parsing questions.json:", error);
    return []; // Return empty array on error
  }
}

// Function to get a specified number of random questions
export function getRandomQuestions(count: number): Question[] {
  const allQuestions = getAllQuestions();
  if (allQuestions.length === 0) {
    return [];
  }
  const shuffledQuestions = shuffleArray(allQuestions);
  return shuffledQuestions.slice(0, Math.min(count, shuffledQuestions.length));
}
