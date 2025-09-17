import { Document } from "@langchain/core/documents";
import { getVectorStore } from "./vectorStore";
import { groqChatCompletion } from "../utils/groqClient";

/**
 * Stores a template document with associated fields in the vector store.
 * @param content The template content.
 * @param fields The fields to extract from documents matching this template.
 */
export async function storeTemplate(content: string, fields: string[]) {
  const store = await getVectorStore();
  // Attach a unique templateId for easier reference
  const templateId = `template-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const doc = new Document({ pageContent: content, metadata: { fields, templateId } });
  await store.addDocuments([doc]);
}

/**
 * Retrieves all templates from the vector store
 * @returns Array of template documents
 */
async function getAllTemplates(): Promise<any[]> {
  const store = await getVectorStore();
  
  // QdrantVectorStore does not expose getDocuments or documents directly.
  // Use similaritySearch with a broad query to retrieve all stored templates.
  // We use a dummy query to get all documents (e.g., empty string or a common word).
  try {
    // Try to retrieve a large number of documents to simulate "get all"
    return await store.similaritySearch("template", 1000);
  } catch (e) {
    // fallback: try with empty string
    try {
      return await store.similaritySearch("", 1000);
    } catch {
      return [];
    }
  }
}

/**
 * Preprocesses document text for better template matching
 * @param text The raw document text
 * @returns Preprocessed text with noise removed and key features highlighted
 */
function preprocessDocumentText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Remove excessive whitespace and normalize
  let processedText = text.replace(/\s+/g, ' ').trim();
  
  // Extract first 2000 characters as a summary (adjust as needed)
  if (processedText.length > 2000) {
    processedText = processedText.substring(0, 2000);
  }
  
  // Remove common noise patterns that don't help with template matching
  processedText = processedText
    // Remove excessive repetitive characters
    .replace(/(.)\1{10,}/g, '$1')
    // Remove standalone numbers that are likely page numbers or artifacts
    .replace(/\b\d{1,2}\b/g, '')
    // Remove common footer/header patterns (customize based on your documents)
    .replace(/\b(page|document|confidential)\s*\d+/gi, '')
    // Normalize dates to a generic pattern
    .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '[DATE]')
    // Normalize email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    // Normalize phone numbers
    .replace(/(\+\d{1,3}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[PHONE]')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  return processedText;
}

/**
 * Formats templates for LLM comparison
 * @param templates Array of template documents
 * @returns Formatted string representation of templates
 */
function formatTemplatesForComparison(templates: any[]): string {
  return templates.map((doc: any, idx: number) => {
    const fields = doc.metadata?.fields ? JSON.stringify(doc.metadata.fields) : "[]";
    // Defensive: pageContent may be undefined
    const content = typeof doc.pageContent === "string" ? doc.pageContent : "";
    // Preprocess template content for consistency
    const processedContent = preprocessDocumentText(content);
    return `Template ${idx + 1}: Fields: ${fields}\nContent: ${processedContent.slice(0, 500)}...`;
  }).join("\n\n");
}

/**
 * Creates the prompt for template matching
 * @param docText The document text to match
 * @param templatesList The formatted list of templates
 * @returns Object containing system and user prompts
 */
function createTemplateMatchingPrompts(docText: string, templatesList: string): { systemPrompt: string, userPrompt: string } {
  const systemPrompt = `You are an intelligent document template matcher. Your task is to identify which template best matches the provided document based on structural and content similarities.

A "match" means the document shares:
1. Similar document structure (headers, sections, layout)
2. Similar types of information (e.g., both are invoices, both are contracts)
3. Overlapping key fields or data points
4. Similar document purpose or function

Respond ONLY with the template number (e.g., 1, 2, 3, etc.) that best matches, or 'none' if no template matches well. If multiple templates could match, choose the best one. Only respond with 'none' if there is no reasonable match at all.

Additionally, provide a confidence score between 0-100 indicating how confident you are in your match. Format your response as: "TemplateNumber, confidence: SCORE" (e.g., "2, confidence: 85")`;

  const userPrompt = `
Document to match:
${docText}

Templates:
${templatesList}

Instructions: Analyze the document and identify which template it most closely resembles based on structure, content types, and purpose. Respond with only the template number and confidence score, or 'none' if there is no good match.`;
  
  return { systemPrompt, userPrompt };
}

/**
 * Parses the LLM response to extract the matched template index and confidence score
 * @param response The LLM response
 * @param templatesCount The number of templates
 * @returns Object with matched template index (0-based) and confidence score, or null if no match
 */
function parseTemplateMatchResponse(response: string, templatesCount: number): { index: number | null, confidence: number } {
  // If the LLM says "none", return null
  if (/none/i.test(response)) return { index: null, confidence: 0 };
  if (typeof response !== "string") return { index: null, confidence: 0 };
  
  // Extract template number and confidence score
  const match = response.match(/(\d+):(\d+)/);
  if (!match || match.length < 3) return { index: null, confidence: 0 };
  
  const templateNumber = parseInt(match[1] || '0', 10);
  const confidence = parseInt(match[2] || '0', 10);
  
  // Validate template number
  const index = templateNumber - 1;
  if (isNaN(index) || index < 0 || index >= templatesCount) return { index: null, confidence: 0 };
  
  return { index, confidence };
}

/**
 * Attempts to match a document's text to a stored template using LLM-based comparison.
 * Returns the matched template's fields and id, or null if no match.
 * @param docText The text of the document to match.
 */
export async function matchTemplate(docText: string): Promise<{ fields: string[]; id: string; confidence: number } | null> {
  const allDocs = await getAllTemplates();
  if (!allDocs.length) return null;

  // Preprocess the document text for better matching
  const preprocessedDocText = preprocessDocumentText(docText);

  // Prepare a prompt for groqChat to identify the best matching template
  const templatesList = formatTemplatesForComparison(allDocs);
  const { systemPrompt, userPrompt } = createTemplateMatchingPrompts(preprocessedDocText, templatesList);

  const response = await groqChatCompletion(systemPrompt, userPrompt);
  const { index: matchedIndex, confidence } = parseTemplateMatchResponse(response, allDocs.length);
  
  if (matchedIndex === null || confidence < 50) return null;

  const matchedDoc = allDocs[matchedIndex];
  return {
    fields: matchedDoc.metadata?.fields || [],
    id: matchedDoc.metadata?.templateId || `template-${matchedIndex + 1}`,
    confidence
  };
}
