import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

const SessionSchema: Schema = new Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }, // Sessions expire automatically
});

// Index for automatic expiration
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISession>('Session', SessionSchema);
