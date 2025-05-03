import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { Question } from '@/types'; // Assuming Question type is defined in types.ts

export interface IQuizState extends Document {
  currentQuestionIndex: number;
  isQuizActive: boolean;
  activeQuizQuestions: Question[];
  bonusQuestionText?: string; // Optional field for the bonus question
  quizSessionId: string; // Unique identifier for a quiz session
  createdAt: Date;
  updatedAt: Date;
}

const QuizStateSchema: Schema = new Schema({
  currentQuestionIndex: { type: Number, default: -1, required: true },
  isQuizActive: { type: Boolean, default: false, required: true },
  activeQuizQuestions: { type: Array, default: [], required: true },
  bonusQuestionText: { type: String, default: '' }, // Default to empty string
  quizSessionId: { type: String, required: true, unique: true, index: true }, // Ensure session ID is unique and indexed
}, { timestamps: true }); // Add createdAt and updatedAt timestamps

// Use existing model if it exists, otherwise create a new one
const QuizState: Model<IQuizState> = models.QuizState || mongoose.model<IQuizState>('QuizState', QuizStateSchema);

export default QuizState;
