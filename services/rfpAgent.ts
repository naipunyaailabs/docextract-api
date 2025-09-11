import { groqChatCompletion } from "../utils/groqClient";
import { rfpSummarizePrompt } from "./rfpAgentPrompt";
import { extractDirectText } from "./fieldExtractor";

interface RfpAgentOptions {
  documentText: string;
  systemPromptOverride?: string;
}

export interface RfpAgentResult {
  raw: string;
  parsed: any | null;
  schemaValid: boolean;
  error?: string;
}

// Utility: Audit required schema keys and array fields
// const requiredKeys = [
//   "title","summary","issuing_organization","reference_number","release_date","due_date","submission_instructions","contact_information","project_overview","requirements","deliverables","evaluation_criteria","key_dates","clauses","terms_and_conditions","appendices","faqs","full_text"
// ];

function validateRfpSchemaFlexible(obj: any): boolean {
  return obj && typeof obj === "object";
}

function stripCodeFences(text: string): string {
  // Remove Markdown code block fences and excessive whitespace
  return text.replace(/^```[a-zA-Z\d]*\n([\s\S]+?)\n```$/m, '$1').trim();
}

export async function runFullRfpDetailAgent(fileBuffer: Buffer, fileName: string, systemPromptOverride?: string): Promise<RfpAgentResult> {
  // Extract as much content as possible using fieldExtractor utilities
  let directText = "", combinedText = "", ocrText = "";
  try {
    // Try direct extraction
    directText = await extractDirectText(fileBuffer, {
      info: () => {}, error: () => {}
    });
    combinedText = directText;
    // If direct extraction is weak, you might want to add OCR and merge (pseudo):
    // ocrText = await performOcrExtraction(fileBuffer, ...); // implement/extend as needed
    // combinedText += "\n" + ocrText;
  } catch (ex) {
    // Accept partials
    combinedText = directText;
  }
  if (!combinedText || combinedText.length < 1000) {
    throw new Error("Document text extraction too weak—cannot summarize with confidence.");
  }
  // Now run the summarizer with all text
  return await runRfpAgent({ documentText: combinedText, systemPromptOverride });
}

export async function runRfpAgent({ documentText, systemPromptOverride }: RfpAgentOptions): Promise<RfpAgentResult> {
  const prompt = rfpSummarizePrompt.replace("{{document_text}}", documentText);
  const systemPrompt = systemPromptOverride || "You are an expert at strict JSON extraction from RFPs. Respond with only valid, comprehensive, nested JSON.";

  let raw = "";
  let parsed: any = null;
  let schemaValid = false;
  let error = undefined;

  try {
    raw = await groqChatCompletion(systemPrompt, prompt);
    const cleaned = stripCodeFences(raw);
    parsed = JSON.parse(cleaned);
    schemaValid = validateRfpSchemaFlexible(parsed);
    if (!schemaValid) {
      error = "RFP extraction response was not a valid JSON object.";
    }
  } catch (ex: any) {
    error = ex?.message || "Error during LLM invocation or parsing.";
  }
  return { raw, parsed, schemaValid, error };
}