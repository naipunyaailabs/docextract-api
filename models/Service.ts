import mongoose, { Document, Schema } from 'mongoose';

export interface IService extends Document {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  endpoint: string;
  supportedFormats: string[];
  supportedFileTypes: string[];
  icon: string;
  category: string;
  fileFieldName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  longDescription: { type: String, required: true },
  endpoint: { type: String, required: true },
  supportedFormats: [{ type: String }],
  supportedFileTypes: [{ type: String }],
  icon: { type: String, required: true },
  category: { type: String, required: true },
  fileFieldName: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IService>('Service', ServiceSchema);