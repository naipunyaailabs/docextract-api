import { extractDoc } from "../services/fieldExtractor";
import { storeTemplate } from "../services/templateStore";
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
import Busboy from '@fastify/busboy';

// Helper function to parse multipart form data
async function parseMultipart(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  console.log("[Upload] Content-Type:", contentType);
  
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
    console.error("[Upload] Native formData parser failed:", e);
    throw new Error("Failed to parse form data: " + (e instanceof Error ? e.message : String(e)));
  }
}

export async function uploadHandler(req: Request): Promise<Response> {
  // Apply authentication
  // Skip API key validation for now
  const isValid = true; // TODO: implement proper API key validation
  if (!isValid) {
    return createErrorResponse("Unauthorized", 401);
  }

  // Check if this is an AG-UI request (has Accept: text/event-stream header)
  const isAGUIRequest = req.headers.get("Accept") === "text/event-stream";
  
  if (isAGUIRequest) {
    return handleAGUIUploadRequest(req);
  }
  
  // Existing non-AGUI implementation for backward compatibility
  try {
    // Check if the body has already been used
    if (req.bodyUsed) {
      return createErrorResponse("Request body has already been consumed", 400);
    }
    
    // Parse form data with fallback
    let file: File | null = null;
    let templateFields: string[] = [];
    
    try {
      const parsedData = await parseMultipart(req);
      file = parsedData.files["document"] || null;
      const fieldsJson = parsedData.fields["fields"] || "[]";
      
      try {
        templateFields = JSON.parse(fieldsJson);
        // Validate that fields is an array of strings
        if (!Array.isArray(templateFields) || !templateFields.every(f => typeof f === 'string')) {
          return createErrorResponse("Fields must be an array of strings", 400);
        }
      } catch (e) {
        return createErrorResponse("Invalid fields format", 400);
      }
    } catch (parseError) {
      console.error("[Upload Handler] FormData parsing error:", parseError);
      // Try direct access as fallback
      try {
        const formData = await req.formData();
        const documentEntry = formData.get("document");
        if (documentEntry instanceof File) {
          file = documentEntry;
        }
        
        const fieldsJson = formData.get("fields")?.toString() || "[]";
        try {
          templateFields = JSON.parse(fieldsJson);
          // Validate that fields is an array of strings
          if (!Array.isArray(templateFields) || !templateFields.every(f => typeof f === 'string')) {
            return createErrorResponse("Fields must be an array of strings", 400);
          }
        } catch (e) {
          return createErrorResponse("Invalid fields format", 400);
        }
      } catch (fallbackError) {
        console.error("[Upload Handler] Fallback parsing also failed:", fallbackError);
        return createErrorResponse(`Failed to parse form data: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 400);
      }
    }

    if (!file) {
      return createErrorResponse("No document file provided", 400);
    }

    const buffer = await file.arrayBuffer();
    const text = await extractDoc(Buffer.from(buffer), file.name, file.type);

    await storeTemplate(text, templateFields);
    // Return the response in the format expected by project.html
    return new Response(JSON.stringify({ 
      message: "Template stored successfully" 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Upload Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to store template" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// AG-UI compatible template upload handler
async function handleAGUIUploadRequest(req: Request): Promise<Response> {
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
          let templateFields: string[] = [];
          
          try {
            const parsedData = await parseMultipart(req);
            file = parsedData.files["document"] || null;
            const fieldsJson = parsedData.fields["fields"] || "[]";
            
            try {
              templateFields = JSON.parse(fieldsJson);
              // Validate that fields is an array of strings
              if (!Array.isArray(templateFields) || !templateFields.every(f => typeof f === 'string')) {
                throw new Error("Fields must be an array of strings");
              }
            } catch (e) {
              throw new Error("Invalid fields format");
            }
          } catch (parseError) {
            console.error("[AGUI Upload] FormData parsing error:", parseError);
            // Try direct access as fallback
            try {
              const formData = await req.formData();
              const documentEntry = formData.get("document");
              if (documentEntry instanceof File) {
                file = documentEntry;
              }
              
              const fieldsJson = formData.get("fields")?.toString() || "[]";
              try {
                templateFields = JSON.parse(fieldsJson);
                // Validate that fields is an array of strings
                if (!Array.isArray(templateFields) || !templateFields.every(f => typeof f === 'string')) {
                  throw new Error("Fields must be an array of strings");
                }
              } catch (e) {
                throw new Error("Invalid fields format");
              }
            } catch (fallbackError) {
              console.error("[AGUI Upload] Fallback parsing also failed:", fallbackError);
              throw new Error(`Failed to parse form data: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
          }
          
          // Get file from form data
          if (!file) {
            throw new Error("No document file provided");
          }
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: `Starting template upload for ${file.name}...\n`
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "extracting_text", fileName: file.name }
          }));
          
          const buffer = await file.arrayBuffer();
          const text = await extractDoc(Buffer.from(buffer), file.name, file.type);
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Processing template document...\n"
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "storing_template" }
          }));
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Storing template in database...\n"
          }));
          
          await storeTemplate(text, templateFields);
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "\nTemplate upload completed successfully!\n"
          }));
          
          // Send final result
          const result = {
            message: "Template stored successfully",
            fileName: file.name,
            fieldsCount: templateFields.length
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
            result
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
    console.error("[AGUI Upload Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to process template upload with AG-UI protocol" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}