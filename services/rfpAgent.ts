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
  htmlSummary?: string;
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
  const systemPrompt = systemPromptOverride || "You are an expert at creating detailed, comprehensive summaries of RFP documents. Create a complete HTML summary of the RFP document, preserving ALL information and translating content to English. Ensure the HTML is well-formed and can be directly rendered in a browser. DO NOT OMIT ANY DETAILS from the original document.";

  let raw = "";
  let parsed: any = null;
  let schemaValid = false;
  let error = undefined;
  let htmlSummary = undefined;

  try {
    console.log("[RFP Agent] Sending request to Groq API with document length:", documentText.length);
    raw = await groqChatCompletion(systemPrompt, prompt);
    console.log("[RFP Agent] Received response from Groq API with raw length:", raw.length);
    
    const cleaned = stripCodeFences(raw);
    console.log("[RFP Agent] Cleaned response length:", cleaned.length);
    
    // Extract HTML content from the response
    htmlSummary = cleaned;
    
    // Check if the response contains HTML
    if (cleaned.includes("<html") || cleaned.includes("<!DOCTYPE")) {
      schemaValid = true;
      console.log("[RFP Agent] HTML summary generated successfully");
    } else {
      error = "RFP summary response was not valid HTML.";
      console.log("[RFP Agent] Response is not valid HTML");
    }
  } catch (ex: any) {
    error = ex?.message || "Error during LLM invocation or parsing.";
    console.log("[RFP Agent] Error during LLM invocation:", error);
  }
  
  console.log("[RFP Agent] Returning result with schemaValid:", schemaValid);
  return { raw, parsed, schemaValid, error, htmlSummary };
}