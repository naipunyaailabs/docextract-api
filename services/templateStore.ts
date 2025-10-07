import { Document } from "@langchain/core/documents";
import { groqChatCompletion } from "../utils/groqClient";

/**
 * Stores a template document with associated fields in memory.
 * @param content The template content.
 * @param fields The fields to extract from documents matching this template.
 */
export async function storeTemplate(content: string, fields: string[]) {
  // In memory implementation - in a production environment, you might want to use a database
  console.log("Template stored in memory:", { content, fields });
  // This is a placeholder implementation since we're removing Qdrant
  return Promise.resolve();
}

/**
 * Attempts to match a document's text to a stored template using a simple string matching approach.
 * Returns null since we're removing Qdrant and template matching is no longer supported.
 * @param docText The text of the document to match.
 */
export async function matchTemplate(docText: string): Promise<{ fields: string[]; id: string; confidence: number } | null> {
  // Template matching is no longer supported without Qdrant
  // Return null to indicate no match
  return null;
}
