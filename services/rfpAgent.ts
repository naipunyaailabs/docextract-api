import { groqChatCompletion } from "../utils/groqClient";
import { rfpSummarizePrompt, rfpMapPrompt, rfpReducePrompt } from "./rfpAgentPrompt";
import { extractDirectText, splitDocumentText } from "./fieldExtractor";

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

/**
 * Validates if the string is a valid HTML structure
 */
function validateHtmlStructure(html: string): boolean {
  return (html.includes("<html") || html.includes("<!DOCTYPE")) && html.includes("</html>");
}

export async function runFullRfpDetailAgent(fileBuffer: Buffer, fileName: string, systemPromptOverride?: string): Promise<RfpAgentResult> {
  // Extract as much content as possible using fieldExtractor utilities
  let directText = "", combinedText = "";
  try {
    // Try direct extraction
    directText = await extractDirectText(fileBuffer, {
      info: () => {}, error: () => {}
    });
    combinedText = directText;
  } catch (ex) {
    // Accept partials
    combinedText = directText;
  }
  
  if (!combinedText || combinedText.length < 50) { // Lowered threshold for "minimal" docs
    throw new Error("Document text extraction too weak—cannot summarize with confidence.");
  }
  
  // Now run the summarizer with all text
  return await runRfpAgent({ documentText: combinedText, systemPromptOverride });
}

async function runMapReduceRfpAgent(chunks: string[], systemPromptOverride?: string): Promise<RfpAgentResult> {
  console.log(`[RFP Agent] Starting Map-Reduce process for ${chunks.length} chunks.`);
  
  // MAP PHASE: Summarize each chunk
  const chunkSummaries: string[] = [];
  const mapSystemPrompt = "You are an expert RFP analyst. Your task is to extract key information from RFP sections with high fidelity.";
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    
    console.log(`[RFP Agent] Processing chunk ${i + 1}/${chunks.length} (length: ${chunk.length})...`);
    try {
      const prompt = (rfpMapPrompt || "").replace("{{document_text}}", chunk);
      // Sequential execution to avoid rate limits
      const summary = await groqChatCompletion(mapSystemPrompt, prompt);
      chunkSummaries.push(summary);
      console.log(`[RFP Agent] Chunk ${i + 1} summary generated (length: ${summary.length}).`);
    } catch (err) {
      console.error(`[RFP Agent] Error processing chunk ${i + 1}:`, err);
      chunkSummaries.push(`[Error summarizing chunk ${i + 1}]`);
    }
  }
  
  // REDUCE PHASE: Combine summaries into final HTML
  const combinedSummaries = chunkSummaries.join("\n\n---\n\n");
  console.log(`[RFP Agent] All chunks processed. Combined summary length: ${combinedSummaries.length}. Generating final HTML...`);
  
  const reducePrompt = rfpReducePrompt.replace("{{document_text}}", combinedSummaries);
  const reduceSystemPrompt = systemPromptOverride || "You are an expert at creating detailed, comprehensive summaries of RFP documents. Create a complete HTML summary of the RFP document, preserving ALL information and translating content to English. Ensure the HTML is well-formed and can be directly rendered in a browser. DO NOT OMIT ANY DETAILS from the original document.";

  return await processLlmResponse(reduceSystemPrompt, reducePrompt);
}

async function processLlmResponse(systemPrompt: string, userPrompt: string): Promise<RfpAgentResult> {
  let raw = "";
  let parsed: any = null;
  let schemaValid = false;
  let error = undefined;
  let htmlSummary = undefined;

  try {
    console.log("[RFP Agent] Sending request to Groq API...");
    raw = await groqChatCompletion(systemPrompt, userPrompt);
    console.log("[RFP Agent] Received response from Groq API with raw length:", raw.length);
    
    const cleaned = stripCodeFences(raw);
    console.log("[RFP Agent] Cleaned response length:", cleaned.length);
    
    // Extract HTML content from the response
    htmlSummary = cleaned;
    
    // Check if the response contains HTML
    if (validateHtmlStructure(cleaned)) {
      schemaValid = true;
      console.log("[RFP Agent] HTML summary generated successfully");
    } else {
      // Try to repair: find first <html and last </html>
      const start = cleaned.indexOf("<html");
      const end = cleaned.lastIndexOf("</html>");
      if (start !== -1 && end !== -1) {
        htmlSummary = cleaned.substring(start, end + 7);
        schemaValid = true;
        console.log("[RFP Agent] HTML summary repaired and validated");
      } else {
        error = "RFP summary response was not valid HTML.";
        console.log("[RFP Agent] Response is not valid HTML");
      }
    }
  } catch (ex: any) {
    error = ex?.message || "Error during LLM invocation or parsing.";
    console.log("[RFP Agent] Error during LLM invocation:", error);
  }
  
  console.log("[RFP Agent] Returning result with schemaValid:", schemaValid);
  return { raw, parsed, schemaValid, error, htmlSummary };
}

export async function runRfpAgent({ documentText, systemPromptOverride }: RfpAgentOptions): Promise<RfpAgentResult> {
  // 1. Check document length and split if necessary (LangChain best practice)
  const chunks = await splitDocumentText(documentText);
  console.log(`[RFP Agent] Document split into ${chunks.length} chunks (approx ${documentText.length} chars).`);

  // Use Map-Reduce for large documents (more than 1 chunk)
  // Note: 25k chars is our chunk size. If it's smaller than that, we just do "Stuff".
  if (chunks.length > 1) {
     return await runMapReduceRfpAgent(chunks, systemPromptOverride);
  }

  // "Stuff" method for single chunk
  const prompt = rfpSummarizePrompt.replace("{{document_text}}", documentText);
  const systemPrompt = systemPromptOverride || "You are an expert at creating detailed, comprehensive summaries of RFP documents. Create a complete HTML summary of the RFP document, preserving ALL information and translating content to English. Ensure the HTML is well-formed and can be directly rendered in a browser. DO NOT OMIT ANY DETAILS from the original document.";

  return await processLlmResponse(systemPrompt, prompt);
}