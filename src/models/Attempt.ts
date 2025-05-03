import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface Answer {
  questionIndex: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timestamp: Date;
}

export interface IAttempt extends Document {
  userName: string;
  quizSessionId: string; // To associate attempts with a specific quiz session
  answers: Answer[];
  score: number;
  feedback: string;
  joinedAt: Date;
  lastActivity: Date;
}

const AnswerSchema: Schema = new Schema({
  questionIndex: { type: Number, required: true },
  selectedOptionIndex: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  timestamp: { type: Date, default: Date.now }
});

const AttemptSchema: Schema = new Schema({
  userName: { type: String, required: true, index: true },
  quizSessionId: { type: String, required: true, index: true }, // Index for faster querying
  answers: { type: [AnswerSchema], default: [] },
  score: { type: Number, default: 0, required: true },
  feedback: { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now, required: true },
  lastActivity: { type: Date, default: Date.now, required: true },
});

// Compound index for efficient user lookup within a session
AttemptSchema.index({ quizSessionId: 1, userName: 1 });

const Attempt: Model<IAttempt> = models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);

export default Attempt;
