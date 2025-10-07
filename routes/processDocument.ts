import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import { validateApiKey } from "../utils/auth";
import { extractHandler } from "./extract";
import { summarizeHandler } from "./summarize";
import { summarizeRfpHandler } from "./summarizeRfp";
import { createRfpHandler } from "./createRfp";
import { uploadHandler } from "./upload";

export async function processDocumentHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(segment => segment);
    
    // Expected path: /process/{serviceId}
    const serviceId = pathSegments[1]; // e.g., "field-extractor", "document-summarizer", etc.

    // Apply authentication to all service routes
    if (!validateApiKey(req)) {
      return createErrorResponse("Unauthorized", 401);
    }

    if (!serviceId) {
      return createErrorResponse("Service ID is required", 400);
    }

    // Route to appropriate handler based on serviceId
    switch (serviceId) {
      case "field-extractor":
        return await extractHandler(req);
      case "document-summarizer":
        return await summarizeHandler(req);
      case "rfp-creator":
        return await createRfpHandler(req);
      case "rfp-summarizer":
        return await summarizeRfpHandler(req);
      case "template-uploader":
        return await uploadHandler(req);
      default:
        return createErrorResponse(`Service ${serviceId} not found`, 404);
    }
  } catch (error) {
    console.error("[Process Document Handler Error]:", error);
    return createErrorResponse("Internal server error", 500);
  }
}