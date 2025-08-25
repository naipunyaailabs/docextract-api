import { extractDoc } from "../services/fieldExtractor";
import { matchTemplate } from "../services/templateStore";
import { groqChatCompletion } from "../utils/groqClient";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import type { ExtractResponse, Template } from "../types";

export async function extractHandler(req: Request): Promise<Response> {
  try {
    // Get form data
    const formData = await req.formData();
    
    // Get file from form data
    const file = formData.get("document");
    if (!file || !(file instanceof File)) {
      return createErrorResponse("No document provided or invalid file", 400);
    }
    
    // Get user prompt from form data
    const userPrompt = formData.get("prompt")?.toString() || "";
    const buffer = await file.arrayBuffer();
    
    // Use extractDoc for all file types
    const text = await extractDoc(Buffer.from(buffer), file.name, file.type);

    // Optionally: Perform template matching and/or field/generic extraction downstream
    const matchedTemplate: Template | null = await matchTemplate(text);
    
    const getExtractionPrompt = (docContent: string) => {
      if (matchedTemplate) {
        return `Extract the following fields from the document: ${matchedTemplate.fields.join(", ")}. Respond ONLY with valid JSON. Do not include explanations, comments, or extra text. The response MUST start with '{' and end with '}'. If you cannot find a field, use null as its value. Document: ${docContent}`;
      } else if (userPrompt.trim()) {
        return `Extract the information described by the user from the document: \"${userPrompt}\" Respond ONLY with valid JSON. Document: ${docContent}`;
      } else {
        return `Extract all key-value pairs, dates, names, organizations, and any other structured information from the following document. Respond ONLY with valid JSON. Document: ${docContent}`;
      }
    };

    const extractionPrompt = getExtractionPrompt(text);
    const response = await groqChatCompletion(
      "You are an advanced document parser and contextual extractor. You deeply understand document structures and can extract both explicit and implicit information. Respond ONLY with valid JSON.",
      extractionPrompt
    );

    let extracted: any = null;
    try {
      const firstBrace = response.indexOf("{");
      const lastBrace = response.lastIndexOf("}");
      extracted = (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace)
        ? JSON.parse(response.slice(firstBrace, lastBrace + 1)) : null;
    } catch {
      extracted = null;
    }

    const result: ExtractResponse = { 
      extracted, 
      templateId: matchedTemplate?.id || null, 
      usedTemplate: !!matchedTemplate 
    };
    
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[Extract Handler Error]:", error);
    return createErrorResponse("Failed to extract information from document", 500, { error: (error as Error).message });
  }
}