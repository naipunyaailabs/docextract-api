import { extractDoc } from "../services/fieldExtractor";
import { runRfpAgent } from "../services/rfpAgent";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";

// RFP HTML Summary API handler
export async function summarizeRfpHandler(req: Request): Promise<Response> {
  try {
    // Get form data
    const formData = await req.formData();
    
    // Get file from form data
    const file = formData.get("document");
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No document provided or invalid file" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const buffer = await file.arrayBuffer();
    const text: string = await extractDoc(Buffer.from(buffer), file.name, file.type);

    // Use the centralized agent for LLM invocation and validation
    const agentResult = await runRfpAgent({ documentText: text });

    if (!agentResult.schemaValid) {
      // Provide a more detailed error message
      const errorMessage = agentResult.error || "Failed to generate RFP summary. The LLM response may not be in the expected format.";
      return new Response(JSON.stringify({ 
        error: errorMessage,
        // Include the raw response for debugging
        rawResponse: agentResult.raw ? agentResult.raw.substring(0, 500) + "... (truncated)" : null
      }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    // Return the HTML summary in the format expected by the frontend
    if (agentResult.htmlSummary) {
      const formattedResponse = {
        success: true,
        data: {
          result: {
            html: agentResult.htmlSummary
          },
          logs: []
        }
      };
      return createSuccessResponse(formattedResponse);
    } else {
      return createErrorResponse("Failed to generate HTML summary", 500);
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to summarize RFP" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}