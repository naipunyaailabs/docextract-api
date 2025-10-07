import { extractDoc, extractDocWithPreprocessing } from "../services/fieldExtractor";
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
    const { originalText, preprocessedText } = await extractDocWithPreprocessing(Buffer.from(buffer), file.name, file.type);

    // Optionally: Perform template matching and/or field/generic extraction downstream
    const matchedTemplateResult = await matchTemplate(preprocessedText);
    const matchedTemplate: Template | null = matchedTemplateResult 
      ? { 
          fields: matchedTemplateResult.fields, 
          id: matchedTemplateResult.id,
          confidence: matchedTemplateResult.confidence
        } 
      : null;
    
    // Only use template-based extraction if confidence is above threshold (e.g., 70)
    const useTemplateExtraction = matchedTemplateResult && matchedTemplateResult.confidence >= 70;
    
    const getExtractionPrompt = (docContent: string) => {
      if (useTemplateExtraction && matchedTemplate) {
        return `Extract the following fields from the document: ${matchedTemplate.fields.join(", ")}. Respond ONLY with valid JSON. Do not include explanations, comments, or extra text. The response MUST start with '{' and end with '}'. If you cannot find a field, use null as its value. Document: ${docContent}`;
      } else if (userPrompt.trim()) {
        return `Extract the information described by the user from the document: \"${userPrompt}\" Respond ONLY with valid JSON. Document: ${docContent}`;
      } else {
        return `Extract all key-value pairs, dates, names, organizations, and any other structured information from the following document. Respond ONLY with valid JSON. Document: ${docContent}`;
      }
    };

    const extractionPrompt = getExtractionPrompt(originalText);
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
      usedTemplate: !!(useTemplateExtraction && matchedTemplate)
    };
    
    // Add confidence information to the response if available
    if (matchedTemplateResult) {
      (result as any).confidence = matchedTemplateResult.confidence;
      (result as any).templateMatch = matchedTemplateResult.id;
    }
    
    // Return the response in the format expected by the frontend
    const formattedResponse = {
      success: true,
      data: {
        result: result,
        logs: []
      }
    };
    
    return createSuccessResponse(formattedResponse);
  } catch (error) {
    console.error("[Extract Handler Error]:", error);
    return createErrorResponse("Failed to extract information from document", 500, { error: (error as Error).message });
  }
}