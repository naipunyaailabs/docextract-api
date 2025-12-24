import { extractDoc } from "../services/fieldExtractor";
import { runRfpAgent } from "../services/rfpAgent";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
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

// RFP HTML Summary API handler
export async function summarizeRfpHandler(req: Request): Promise<Response> {
  // Check if this is an AG-UI request (has Accept: text/event-stream header)
  const isAGUIRequest = req.headers.get("Accept") === "text/event-stream";
  
  if (isAGUIRequest) {
    return handleAGUISummarizeRfpRequest(req);
  }
  
  // Existing non-AGUI implementation for backward compatibility
  try {
    // Clone the request to avoid "Body already used" error
    const reqClone = req.clone();
    
    // Get form data
    const formData = await reqClone.formData();
    
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

    // Return the HTML summary in the format expected by project.html
    if (agentResult.htmlSummary) {
      return new Response(agentResult.htmlSummary, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    } else {
      return new Response(JSON.stringify({ error: "Failed to generate HTML summary" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to summarize RFP" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

// AG-UI compatible RFP summarization handler
async function handleAGUISummarizeRfpRequest(req: Request): Promise<Response> {
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
          
          // Clone the request to avoid "Body already used" error
          const reqClone = req.clone();
          
          // Get form data
          const formData = await reqClone.formData();
          
          // Get file from form data
          const file = formData.get("document");
          if (!file || !(file instanceof File)) {
            throw new Error("No document provided or invalid file");
          }
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: `Starting RFP summarization for ${file.name}...\n`
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "extracting_text", fileName: file.name }
          }));
          
          const buffer = await file.arrayBuffer();
          const text: string = await extractDoc(Buffer.from(buffer), file.name, file.type);
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Analyzing RFP structure...\n"
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "generating_summary" }
          }));
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Extracting key requirements...\n"
          }));
          
          // Use the centralized agent for LLM invocation and validation
          const agentResult = await runRfpAgent({ documentText: text });
          
          if (!agentResult.schemaValid) {
            throw new Error(agentResult.error || "Failed to generate RFP summary. The LLM response may not be in the expected format.");
          }
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "\nRFP summarization completed successfully!\n"
          }));
          
          // Send final result
          const result = {
            schemaValid: agentResult.schemaValid,
            htmlSummary: agentResult.htmlSummary ? agentResult.htmlSummary.substring(0, 200) + "..." : null
          };
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: `\nResults:\n${JSON.stringify(result, null, 2)}\n`
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
            result: agentResult
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
    console.error("[AGUI Summarize RFP Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to process RFP summarization with AG-UI protocol" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}