import { extractDoc } from "../services/fieldExtractor";
import { storeTemplate } from "../services/templateStore";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import type { UploadResponse } from "../types";

export async function uploadHandler(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get("document");
    if (!file || !(file instanceof File)) {
      return createErrorResponse("No document file provided", 400);
    }
    
    const fieldsJson = formData.get("fields")?.toString() || "[]";
    let fields: string[] = [];
    try {
      fields = JSON.parse(fieldsJson);
      // Validate that fields is an array of strings
      if (!Array.isArray(fields) || !fields.every(f => typeof f === 'string')) {
        return createErrorResponse("Fields must be an array of strings", 400);
      }
    } catch (e) {
      return createErrorResponse("Invalid fields format", 400);
    }

    const buffer = await file.arrayBuffer();
    const text = await extractDoc(Buffer.from(buffer), file.name, file.type);

    await storeTemplate(text, fields);
    // Return the response in the format expected by the frontend
    const formattedResponse = {
      success: true,
      data: {
        result: { message: "Template stored successfully" },
        logs: []
      }
    };
    return createSuccessResponse(formattedResponse);
  } catch (error) {
    console.error("[Upload Handler Error]:", error);
    return createErrorResponse("Failed to store template", 500, { error: (error as Error).message });
  }
}