import mongoose, { Schema, Document, models, Model } from 'mongoose';

// Interface for standard answers
export interface StandardAnswer {
  questionIndex: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timestamp: Date;
}

// Updated Attempt interface
export interface IAttempt extends Document {
  quizSessionId: string;
  answers: StandardAnswer[]; // Renamed for clarity, stores only standard answers
  score: number;
  bonusAnswerText?: string; // Added field for bonus answer text
  joinedAt: Date;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for standard answers
const StandardAnswerSchema: Schema = new Schema({
  questionIndex: { type: Number, required: true },
  selectedOptionIndex: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Updated Attempt schema
const AttemptSchema: Schema = new Schema({
  quizSessionId: { type: String, required: true, index: true },
  answers: { type: [StandardAnswerSchema], default: [] }, // Stores only standard answers
  score: { type: Number, default: 0, required: true },
  bonusAnswerText: { type: String, default: null }, // Added field, default to null or empty string
  joinedAt: { type: Date, required: true },
  lastActivity: { type: Date, default: Date.now, required: true },
}, { timestamps: true });


const Attempt: Model<IAttempt> = models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);

export default Attempt;
export type { IAttempt }; // Export the interface type as well
