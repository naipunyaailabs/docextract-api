import { extractDoc } from "../services/fieldExtractor";
import { groqChatCompletion } from "../utils/groqClient";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";

export async function summarizeHandler(req: Request): Promise<Response> {
  try {
    // Get form data
    const formData = await req.formData();
    
    // Get file from form data
    const file = formData.get("document");
    if (!file || !(file instanceof File)) {
      return createErrorResponse("No document provided or invalid file", 400);
    }
    
    // Get user prompt from form data
    const userPrompt: string = formData.get("prompt")?.toString() || "";
    const buffer = await file.arrayBuffer();
    
    // Use extractDoc to get text content
    const text: string = await extractDoc(Buffer.from(buffer), file.name, file.type);

    // Create summarization prompt with Tailwind CSS formatting instructions
    const summarizationPrompt: string = userPrompt.trim() 
      ? `Summarize the following document focusing on: ${userPrompt}. Format the summary using HTML with Tailwind CSS classes:
      <div class="min-h-screen bg-gray-50 py-12">
        <div class="max-w-4xl mx-auto px-4">
          <div class="bg-white rounded-xl shadow-lg p-8">
            <div class="space-y-8">
              <h2 class="text-3xl font-bold text-gray-900 text-center">Summary</h2>
              <div class="prose prose-lg text-gray-700">
                <div class="space-y-6">
                  <h3 class="text-2xl font-semibold text-gray-800">Key Points</h3>
                  <ul class="list-disc pl-8 space-y-3">
                    <li class="text-gray-700 leading-relaxed">Point 1</li>
                    <li class="text-gray-700 leading-relaxed">Point 2</li>
                  </ul>
                </div>
                <div class="space-y-6">
                  <h3 class="text-2xl font-semibold text-gray-800">Main Ideas</h3>
                  <p class="text-gray-700 leading-relaxed">Main idea description</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      Document: ${text}`
      : `Provide a comprehensive summary of the following document. Include key points, main ideas, and important details. Format the summary using HTML with Tailwind CSS classes:
      <div class="min-h-screen bg-gray-50 py-12">
        <div class="max-w-4xl mx-auto px-4">
          <div class="bg-white rounded-xl shadow-lg p-8">
            <div class="space-y-8">
              <h2 class="text-3xl font-bold text-gray-900 text-center">Document Summary</h2>
              <div class="prose prose-lg text-gray-700">
                <div class="space-y-6">
                  <h3 class="text-2xl font-semibold text-gray-800">Overview</h3>
                  <p class="text-gray-700 leading-relaxed">Overall summary text</p>
                </div>
                <div class="space-y-6">
                  <h3 class="text-2xl font-semibold text-gray-800">Key Insights</h3>
                  <ul class="list-disc pl-8 space-y-3">
                    <li class="text-gray-700 leading-relaxed">Insight 1</li>
                    <li class="text-gray-700 leading-relaxed">Insight 2</li>
                  </ul>
                </div>
                <div class="space-y-6">
                  <h3 class="text-2xl font-semibold text-gray-800">Important Details</h3>
                  <p class="text-gray-700 leading-relaxed">Details description</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      Document: ${text}`;

    const summary: string = await groqChatCompletion(
      "You are an advanced document summarizer. You can understand complex documents and create concise, accurate summaries. Format your response using HTML with Tailwind CSS classes. Focus on the most important information and maintain the document's key meaning.",
      summarizationPrompt
    );

    // Return the response in the format expected by the frontend
    const formattedResponse = {
      success: true,
      data: {
        result: {
          summary: summary.trim()
        },
        logs: []
      }
    };
    
    return createSuccessResponse(formattedResponse);
  } catch (error) {
    console.error("[Summarize Handler Error]:", error);
    // Return HTML error response for frontend compatibility
    return new Response(
      `<div class='p-4 bg-red-50 text-red-700 rounded-lg text-center max-w-2xl mx-auto mt-8'>
        <h3 class="font-bold">Error</h3>
        <p>Failed to summarize document: ${(error as Error).message}</p>
       </div>`, 
      { 
        status: 500,
        headers: { "Content-Type": "text/html" }
      }
    );
  }
}