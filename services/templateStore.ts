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
 * Attempts to match a document's text to a stored template using LLM-based comparison.
 * Returns the matched template's fields and id, or null if no match.
 * @param docText The text of the document to match.
 */
export async function matchTemplate(docText: string): Promise<{ fields: string[]; id: string } | null> {
  const store = await getVectorStore();

  // QdrantVectorStore does not expose getDocuments or documents directly.
  // Use similaritySearch with a broad query to retrieve all stored templates.
  // We use a dummy query to get all documents (e.g., empty string or a common word).
  let allDocs: any[] = [];
  try {
    // Try to retrieve a large number of documents to simulate "get all"
    allDocs = await store.similaritySearch("template", 1000);
  } catch (e) {
    // fallback: try with empty string
    try {
      allDocs = await store.similaritySearch("", 1000);
    } catch {
      allDocs = [];
    }
  }
  if (!allDocs.length) return null;

  // Prepare a prompt for groqChat to identify the best matching template
  const templatesList = allDocs.map((doc: any, idx: number) => {
    const fields = doc.metadata?.fields ? JSON.stringify(doc.metadata.fields) : "[]";
    // Defensive: pageContent may be undefined
    const content = typeof doc.pageContent === "string" ? doc.pageContent : "";
    return `Template ${idx + 1}: Fields: ${fields}\nContent: ${content.slice(0, 500)}...`;
  }).join("\n\n");

  const systemPrompt = "You are an intelligent document template matcher. Given a document and a list of templates, identify which template best matches the document. Respond ONLY with the template number (e.g., 1, 2, 3, etc.) or 'none' if no template matches well.";
  const userPrompt = `
Document to match:
${docText}

Templates:
${templatesList}
`;

  const response = await groqChatCompletion(systemPrompt, userPrompt);
  // If the LLM says "none", return null
  if (/none/i.test(response)) return null;
  if (typeof response !== "string") return null;
  const match = response.match(/(\d+)/);
  if (!match || !match[1]) return null;
  const idx = parseInt(match[1], 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= allDocs.length) return null;

  const matchedDoc = allDocs[idx];
  return {
    fields: matchedDoc.metadata?.fields || [],
    id: matchedDoc.metadata?.templateId || `template-${idx + 1}`,
  };
}
