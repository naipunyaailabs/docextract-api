// Request and response types for API endpoints

export interface UploadRequest {
  document: File;
  fields?: string[];
}

export interface ExtractRequest {
  document: File;
  prompt?: string;
}

export interface SummarizeRequest {
  document: File;
  prompt?: string;
}

export interface UploadResponse {
  message: string;
}

export interface ExtractResponse {
  extracted: any;
  templateId: string | null;
  usedTemplate: boolean;
}

export interface Template {
  fields: string[];
  id: string;
}

export interface LanguageDetectionResult {
  language: string;
  score: number;
}

export interface DocumentExtractionResult {
  text: string;
  language: string;
  score: number;
}