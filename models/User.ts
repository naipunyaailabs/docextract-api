import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  name: string;
  email: string;
  password: string;
  role: string;
  lastLoginAt: Date;
  preferences: string; // JSON string
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationTokenExpiry?: Date;
  createdAt: Date;
  designation: string | null;
  companyName: string | null;
  useCase: string | null;
  subscribedToNewsletter: boolean;
  agreedToTermsAt: Date;
}

const UserSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  lastLoginAt: { type: Date, default: Date.now },
  preferences: { type: String, default: '{}' },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now },
  designation: { type: String, default: null },
  companyName: { type: String, default: null },
  useCase: { type: String, default: null },
  subscribedToNewsletter: { type: Boolean, default: false },
  agreedToTermsAt: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>('User', UserSchema);