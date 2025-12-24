import { createRfp, createStandardRfp, createRfpWordDocument } from "../services/rfpCreator";
import type { RfpSection } from "../services/rfpCreator";
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

interface CreateRfpRequest {
  title: string;
  organization: string;
  deadline: string;
  sections?: RfpSection[];
}

export async function createRfpHandler(req: Request): Promise<Response> {
  // Apply authentication
  if (!(await validateApiKey(req))) {
    return createErrorResponse("Unauthorized", 401);
  }

  // Check if this is an AG-UI request (has Accept: text/event-stream header)
  const isAGUIRequest = req.headers.get("Accept") === "text/event-stream";
  
  if (isAGUIRequest) {
    return handleAGUICreateRfpRequest(req);
  }
  
  // Existing non-AGUI implementation for backward compatibility
  try {
    // Get JSON data from request
    let requestData: CreateRfpRequest;
    try {
      requestData = await req.json() as CreateRfpRequest;
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: "Invalid JSON data" 
      }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    
    // Validate required fields
    if (!requestData.title || !requestData.organization || !requestData.deadline) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: title, organization, and deadline are required" 
      }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    
    let rfpContent: import("../services/rfpCreator").RfpContent;
    
    // Log the incoming request data for debugging
    console.log('[CreateRfpHandler] Incoming request data:', {
      title: requestData.title,
      organization: requestData.organization,
      deadline: requestData.deadline,
      sections: requestData.sections,
      hasSections: !!requestData.sections,
      sectionsCount: requestData.sections ? requestData.sections.length : 0
    });
    
    if (requestData.sections && requestData.sections.length > 0) {
      // Log the sections being sent to createRfp
      console.log('[CreateRfpHandler] Creating custom RFP with sections:', requestData.sections);
      
      // Create custom RFP with provided sections
      try {
        rfpContent = await createRfp({
          title: requestData.title,
          organization: requestData.organization,
          deadline: requestData.deadline,
          sections: requestData.sections
        });
      } catch (rfpError: any) {
        console.error('[CreateRfpHandler] Error creating custom RFP:', rfpError);
        return new Response(JSON.stringify({ 
          error: `Failed to create custom RFP: ${rfpError.message || "Unknown error"}` 
        }), { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        });
      }
    } else {
      // Log that we're creating a standard RFP
      console.log('[CreateRfpHandler] Creating standard RFP with default sections');
      
      // Create standard RFP with default sections
      try {
        rfpContent = await createStandardRfp(
          requestData.title,
          requestData.organization,
          requestData.deadline
        );
      } catch (standardRfpError: any) {
        console.error('[CreateRfpHandler] Error creating standard RFP:', standardRfpError);
        return new Response(JSON.stringify({ 
          error: `Failed to create standard RFP: ${standardRfpError.message || "Unknown error"}` 
        }), { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        });
      }
    }
    
    // Validate that we have content to work with
    if (!rfpContent) {
      console.error('[CreateRfpHandler] No RFP content generated');
      return new Response(JSON.stringify({ 
        error: "Failed to generate RFP content" 
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    
    // Validate that we have sections
    if (!rfpContent.sections || rfpContent.sections.length === 0) {
      console.warn('[CreateRfpHandler] No sections in RFP content, creating default section');
      rfpContent.sections = [{
        title: "Untitled Section",
        content: "Please provide detailed information for this section."
      }];
    }
    
    // Log the generated content for debugging
    console.log('[CreateRfpHandler] Generated RFP content with', rfpContent.sections.length, 'sections');
    console.log('[CreateRfpHandler] RFP Title:', rfpContent.title);
    console.log('[CreateRfpHandler] RFP Organization:', rfpContent.organization);
    console.log('[CreateRfpHandler] RFP Deadline:', rfpContent.deadline);
    console.log('[CreateRfpHandler] First few sections:', rfpContent.sections.slice(0, 2));
    
    // Create Word document from the RFP content
    console.log('[CreateRfpHandler] Generating Word document...');
    try {
      const wordBuffer = await createRfpWordDocument(rfpContent);
      console.log('[CreateRfpHandler] Word document generated successfully');
      
      // Return the Word document as a blob response (this is what project.html expects)
      return new Response(wordBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${requestData.title.replace(/\s+/g, '_')}_RFP.docx"`
        }
      });
    } catch (docError: any) {
      console.error('[CreateRfpHandler] Error generating Word document:', docError);
      return new Response(JSON.stringify({ 
        error: `Failed to generate Word document: ${docError.message || "Unknown error"}` 
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    }
  } catch (error: any) {
    console.error('[CreateRfpHandler] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to create RFP" 
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}

// AG-UI compatible RFP creation handler
async function handleAGUICreateRfpRequest(req: Request): Promise<Response> {
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
          
          // Get JSON data from request
          let requestData: CreateRfpRequest;
          try {
            requestData = await req.json() as CreateRfpRequest;
          } catch (e) {
            throw new Error("Invalid JSON data");
          }
          
          // Validate required fields
          if (!requestData.title || !requestData.organization || !requestData.deadline) {
            throw new Error("Missing required fields: title, organization, and deadline are required");
          }
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: `Starting RFP creation for "${requestData.title}"...\n`
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "validating_input" }
          }));
          
          let rfpContent: import("../services/rfpCreator").RfpContent;
          
          if (requestData.sections && requestData.sections.length > 0) {
            sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
              type: AGUIEventType.TEXT_MESSAGE_CONTENT,
              messageId,
              delta: "Creating custom RFP with provided sections...\n"
            }));
            
            // Create custom RFP with provided sections
            rfpContent = await createRfp({
              title: requestData.title,
              organization: requestData.organization,
              deadline: requestData.deadline,
              sections: requestData.sections
            });
          } else {
            sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
              type: AGUIEventType.TEXT_MESSAGE_CONTENT,
              messageId,
              delta: "Creating standard RFP with default sections...\n"
            }));
            
            // Create standard RFP with default sections
            rfpContent = await createStandardRfp(
              requestData.title,
              requestData.organization,
              requestData.deadline
            );
          }
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "generating_document" }
          }));
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Generating professional RFP document...\n"
          }));
          
          // Create Word document from the RFP content
          const wordBuffer = await createRfpWordDocument(rfpContent);
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "\nRFP creation completed successfully!\n"
          }));
          
          // Send final result
          const result = {
            title: rfpContent.title,
            organization: rfpContent.organization,
            deadline: rfpContent.deadline,
            sectionsCount: rfpContent.sections.length
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
          
          // Send RUN_FINISHED event with document as base64
          // Convert Uint8Array to base64
          const base64Document = Buffer.from(wordBuffer).toString('base64');
          sendSSEEvent(controller, createAGUIEvent<RunFinishedEvent>({
            type: AGUIEventType.RUN_FINISHED,
            threadId,
            runId,
            result: { 
              ...result,
              document: base64Document,
              filename: `${requestData.title.replace(/\s+/g, '_')}_RFP.docx`
            }
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
    console.error("[AGUI Create RFP Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to process RFP creation with AG-UI protocol" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}