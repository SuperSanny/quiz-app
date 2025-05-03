
export interface Question {
  id: string;
  questionText: string;
  options: string[]; // Keep options array, will be empty for bonus question
  correctAnswerIndex?: number; // Make optional for bonus question
  isBonusQuestion?: boolean; // Optional flag for bonus question type in API response
}

export interface QuizStateData {
  currentQuestionIndex: number;
  isQuizActive: boolean;
  quizSessionId?: string; // Optional: useful for identifying current session
}

export interface ScoreData {
  // userName: string; // Removed
  userId: string; // Use userId (Attempt._id) as identifier
  score: number;
  rank?: number; // Optional: rank can be added on the server
}

export interface UserInfo {
  userId: string; // Corresponds to Attempt._id in the database
  // userName: string; // Removed
  quizSessionId: string;
}

// Updated type for question stats
export interface QuestionStats {
    questionIndex: number;
    questionText: string;
    correctPercentage: number;
    incorrectPercentage: number; // Added
    totalAttempts: number;
    correctCount: number; // Added
    incorrectCount: number; // Added
    // bonusAnswerText?: string; // Optional: Add if you need to display bonus answer text in stats
}
