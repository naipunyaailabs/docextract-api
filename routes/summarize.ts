import { extractDoc } from "../services/fieldExtractor";
import { groqChatCompletion } from "../utils/groqClient";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import { validateApiKey } from "../utils/auth";
import {
  AGUIEventType,
  createAGUIEvent,
  sendSSEEvent,
  createSSEHeaders,
  generateThreadId,
  generateRunId,
  generateMessageId,
  type RunStartedEvent,
  type RunFinishedEvent,
  type RunErrorEvent,
  type TextMessageStartEvent,
  type TextMessageContentEvent,
  type TextMessageEndEvent,
  type StateDeltaEvent
} from "../utils/agui";
import Busboy from '@fastify/busboy';

// Helper function to parse multipart form data
async function parseMultipart(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  console.log("[Summarize] Content-Type:", contentType);
  
  // Use native formData parser for all cases - it handles both multipart and other forms
  try {
    // Try native parser which can handle multipart/form-data natively
    const formData = await req.formData();
    const fields: Record<string, any> = {};
    const files: Record<string, File> = {};
    
    // Extract all entries
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files[key] = value;
      } else {
        fields[key] = value;
      }
    }
    
    return { fields, files };
  } catch (e) {
    console.error("[Summarize] Native formData parser failed:", e);
    throw new Error("Failed to parse form data: " + (e instanceof Error ? e.message : String(e)));
  }
}

export async function summarizeHandler(req: Request): Promise<Response> {
  // Apply authentication
  if (!(await validateApiKey(req))) {
    return createErrorResponse("Unauthorized", 401);
  }

  // Check if this is an AG-UI request (has Accept: text/event-stream header)
  const isAGUIRequest = req.headers.get("Accept") === "text/event-stream";
  
  if (isAGUIRequest) {
    return handleAGUISummarizeRequest(req);
  }
  
  // Existing non-AGUI implementation for backward compatibility
  try {
    // Check if the body has already been used
    if (req.bodyUsed) {
      return createErrorResponse("Request body has already been consumed", 400);
    }
    
    // Parse form data with fallback
    let file: File | null = null;
    let userPrompt = "";
    
    try {
      const parsedData = await parseMultipart(req);
      file = parsedData.files["document"] || null;
      userPrompt = parsedData.fields["prompt"] || "";
    } catch (parseError) {
      console.error("[Summarize Handler] FormData parsing error:", parseError);
      // Try direct access as fallback
      try {
        const formData = await req.formData();
        const documentEntry = formData.get("document");
        if (documentEntry instanceof File) {
          file = documentEntry;
        }
        userPrompt = formData.get("prompt")?.toString() || "";
      } catch (fallbackError) {
        console.error("[Summarize Handler] Fallback parsing also failed:", fallbackError);
        return createErrorResponse(`Failed to parse form data: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 400);
      }
    }
    
    if (!file) {
      return createErrorResponse("No document provided or invalid file", 400);
    }
    
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

    // Return the response in the format expected by project.html (HTML content)
    return new Response(summary.trim(), {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
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

// AG-UI compatible document summarization handler
async function handleAGUISummarizeRequest(req: Request): Promise<Response> {
  try {
    // Create a new ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const threadId = generateThreadId();
        const runId = generateRunId();
        const messageId = generateMessageId();
        
        try {
          // Send RUN_STARTED event
          sendSSEEvent(controller, createAGUIEvent<RunStartedEvent>({
            type: AGUIEventType.RUN_STARTED,
            threadId,
            runId
          }));
          
          // Send TEXT_MESSAGE_START event
          sendSSEEvent(controller, createAGUIEvent<TextMessageStartEvent>({
            type: AGUIEventType.TEXT_MESSAGE_START,
            messageId,
            role: "assistant"
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "receiving_document" }
          }));
          
          // Parse form data with fallback
          let file: File | null = null;
          let userPrompt = "";
          
          try {
            const parsedData = await parseMultipart(req);
            file = parsedData.files["document"] || null;
            userPrompt = parsedData.fields["prompt"] || "";
          } catch (parseError) {
            console.error("[AGUI Summarize] FormData parsing error:", parseError);
            // Try direct access as fallback
            try {
              const formData = await req.formData();
              const documentEntry = formData.get("document");
              if (documentEntry instanceof File) {
                file = documentEntry;
              }
              userPrompt = formData.get("prompt")?.toString() || "";
            } catch (fallbackError) {
              console.error("[AGUI Summarize] Fallback parsing also failed:", fallbackError);
              throw new Error(`Failed to parse form data: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
          }
          
          // Get file from form data
          if (!file) {
            throw new Error("No document provided or invalid file");
          }
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: `Starting document summarization for ${file.name}...\n`
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "extracting_text", fileName: file.name }
          }));
          
          const buffer = await file.arrayBuffer();
          
          // Use extractDoc to get text content
          const text: string = await extractDoc(Buffer.from(buffer), file.name, file.type);
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Analyzing document content...\n"
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "generating_summary" }
          }));
          
          // Create summarization prompt with Tailwind CSS formatting instructions
          const summarizationPrompt: string = userPrompt.trim() 
            ? `Summarize the following document focusing on: ${userPrompt}. Format the summary using HTML with Tailwind CSS classes. Structure your response with these sections:
1. Overview - A brief summary of the document
2. Key Insights - Important points from the document
3. Important Details - Additional relevant information

Use this HTML structure with Tailwind CSS classes:
<div class="min-h-screen bg-gray-50 py-12">
  <div class="max-w-4xl mx-auto px-4">
    <div class="bg-white rounded-xl shadow-lg p-8">
      <div class="space-y-8">
        <h2 class="text-3xl font-bold text-gray-900 text-center">Summary</h2>
        <div class="prose prose-lg text-gray-700">
          <div class="space-y-6">
            <h3 class="text-2xl font-semibold text-gray-800">Overview</h3>
            <p class="text-gray-700 leading-relaxed">[Your overview content here]</p>
          </div>
          <div class="space-y-6">
            <h3 class="text-2xl font-semibold text-gray-800">Key Insights</h3>
            <ul class="list-disc pl-8 space-y-3">
              <li class="text-gray-700 leading-relaxed">[Key insight 1]</li>
              <li class="text-gray-700 leading-relaxed">[Key insight 2]</li>
            </ul>
          </div>
          <div class="space-y-6">
            <h3 class="text-2xl font-semibold text-gray-800">Important Details</h3>
            <p class="text-gray-700 leading-relaxed">[Important details content]</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
Document: ${text}`
            : `Provide a comprehensive summary of the following document. Include key points, main ideas, and important details. Format the summary using HTML with Tailwind CSS classes. Structure your response with these sections:
1. Overview - A brief summary of the document
2. Key Insights - Important points from the document
3. Important Details - Additional relevant information

Use this HTML structure with Tailwind CSS classes:
<div class="min-h-screen bg-gray-50 py-12">
  <div class="max-w-4xl mx-auto px-4">
    <div class="bg-white rounded-xl shadow-lg p-8">
      <div class="space-y-8">
        <h2 class="text-3xl font-bold text-gray-900 text-center">Document Summary</h2>
        <div class="prose prose-lg text-gray-700">
          <div class="space-y-6">
            <h3 class="text-2xl font-semibold text-gray-800">Overview</h3>
            <p class="text-gray-700 leading-relaxed">[Your overview content here]</p>
          </div>
          <div class="space-y-6">
            <h3 class="text-2xl font-semibold text-gray-800">Key Insights</h3>
            <ul class="list-disc pl-8 space-y-3">
              <li class="text-gray-700 leading-relaxed">[Key insight 1]</li>
              <li class="text-gray-700 leading-relaxed">[Key insight 2]</li>
            </ul>
          </div>
          <div class="space-y-6">
            <h3 class="text-2xl font-semibold text-gray-800">Important Details</h3>
            <p class="text-gray-700 leading-relaxed">[Important details content]</p>
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
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "\nDocument summarization completed successfully!\n"
          }));
          
          // Send final result
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: `\nResults:\n${JSON.stringify({ summary }, null, 2)}\n`
          }));
          
          // Send TEXT_MESSAGE_END event
          sendSSEEvent(controller, createAGUIEvent<TextMessageEndEvent>({
            type: AGUIEventType.TEXT_MESSAGE_END,
            messageId
          }));
          
          // Send RUN_FINISHED event
          sendSSEEvent(controller, createAGUIEvent<RunFinishedEvent>({
            type: AGUIEventType.RUN_FINISHED,
            threadId,
            runId,
            result: { summary }
          }));
          
          // Close the stream
          controller.close();
        } catch (error) {
          // Send RUN_ERROR event
          sendSSEEvent(controller, createAGUIEvent<RunErrorEvent>({
            type: AGUIEventType.RUN_ERROR,
            message: (error as Error).message,
            code: "PROCESSING_ERROR"
          }));
          
          // Close the stream
          controller.close();
        }
      }
    });
    
    // Return SSE response
    return new Response(stream, {
      headers: createSSEHeaders()
    });
  } catch (error) {
    console.error("[AGUI Summarize Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to process document summarization with AG-UI protocol" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}