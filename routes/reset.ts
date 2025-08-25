import { resetVectorStore } from "../services/vectorStore";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";

export default async function (req: Request): Promise<Response> {
  try {
    await resetVectorStore();
    return createSuccessResponse({ success: true, message: "All collections reset." });
  } catch (error) {
    console.error("[Reset Handler Error]:", error);
    return createErrorResponse("Failed to reset collections", 500, { error: (error as Error).message });
  }
}