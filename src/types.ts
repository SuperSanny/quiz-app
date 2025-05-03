export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface QuizStateData {
  currentQuestionIndex: number;
  isQuizActive: boolean;
  quizSessionId?: string; // Optional: useful for identifying current session
}

export interface ScoreData {
  userName: string;
  score: number;
  rank?: number; // Optional: rank can be added on the server
}

export interface UserInfo {
  userId: string; // Corresponds to Attempt._id in the database
  userName: string;
  quizSessionId: string;
}
