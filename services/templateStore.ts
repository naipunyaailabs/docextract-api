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
 * Formats templates for LLM comparison
 * @param templates Array of template documents
 * @returns Formatted string representation of templates
 */
function formatTemplatesForComparison(templates: any[]): string {
  return templates.map((doc: any, idx: number) => {
    const fields = doc.metadata?.fields ? JSON.stringify(doc.metadata.fields) : "[]";
    // Defensive: pageContent may be undefined
    const content = typeof doc.pageContent === "string" ? doc.pageContent : "";
    return `Template ${idx + 1}: Fields: ${fields}\nContent: ${content.slice(0, 500)}...`;
  }).join("\n\n");
}

/**
 * Creates the prompt for template matching
 * @param docText The document text to match
 * @param templatesList The formatted list of templates
 * @returns Object containing system and user prompts
 */
function createTemplateMatchingPrompts(docText: string, templatesList: string): { systemPrompt: string, userPrompt: string } {
  const systemPrompt = "You are an intelligent document template matcher. Given a document and a list of templates, identify which template best matches the document. Respond ONLY with the template number (e.g., 1, 2, 3, etc.) or 'none' if no template matches well.";
  const userPrompt = `
Document to match:
${docText}

Templates:
${templatesList}
`;
  
  return { systemPrompt, userPrompt };
}

/**
 * Parses the LLM response to extract the matched template index
 * @param response The LLM response
 * @param templatesCount The number of templates
 * @returns The matched template index (0-based) or null if no match
 */
function parseTemplateMatchResponse(response: string, templatesCount: number): number | null {
  // If the LLM says "none", return null
  if (/none/i.test(response)) return null;
  if (typeof response !== "string") return null;
  
  const match = response.match(/(\d+)/);
  if (!match || !match[1]) return null;
  
  const idx = parseInt(match[1], 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= templatesCount) return null;
  
  return idx;
}

/**
 * Attempts to match a document's text to a stored template using LLM-based comparison.
 * Returns the matched template's fields and id, or null if no match.
 * @param docText The text of the document to match.
 */
export async function matchTemplate(docText: string): Promise<{ fields: string[]; id: string } | null> {
  const allDocs = await getAllTemplates();
  if (!allDocs.length) return null;

  // Prepare a prompt for groqChat to identify the best matching template
  const templatesList = formatTemplatesForComparison(allDocs);
  const { systemPrompt, userPrompt } = createTemplateMatchingPrompts(docText, templatesList);

  const response = await groqChatCompletion(systemPrompt, userPrompt);
  const matchedIndex = parseTemplateMatchResponse(response, allDocs.length);
  
  if (matchedIndex === null) return null;

  const matchedDoc = allDocs[matchedIndex];
  return {
    fields: matchedDoc.metadata?.fields || [],
    id: matchedDoc.metadata?.templateId || `template-${matchedIndex + 1}`,
  };
}