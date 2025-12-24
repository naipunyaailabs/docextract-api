import { extractDoc, extractDocWithPreprocessing } from "../services/fieldExtractor";
import { matchTemplate } from "../services/templateStore";
import { groqChatCompletion } from "../utils/groqClient";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import type { ExtractResponse, Template } from "../types";
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
  console.log("[Extract] Content-Type:", contentType);
  
  // If it's not multipart, try to use the native formData parser
  if (!contentType.startsWith("multipart/form-data")) {
    try {
      // Try native parser as fallback
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
      console.error("[Extract] Native formData parser failed:", e);
      throw new Error("Invalid Content-Type for multipart form data and native parser failed");
    }
  }

  return new Promise<{ fields: Record<string, any>, files: Record<string, File> }>((resolve, reject) => {
    const bb = Busboy({ headers: { 'content-type': contentType } });
    const fields: Record<string, any> = {};
    const files: Record<string, File> = {};

    const body = req.body as any;

    // Convert ReadableStream to Buffer for Busboy
    const chunks: Buffer[] = [];
    const reader = body.getReader();
    
    function read() {
      reader.read().then((result: { done: boolean; value: Uint8Array }) => {
        const { done, value } = result;
        if (done) {
          try {
            const buf = Buffer.concat(chunks);
            bb.write(buf);
            bb.end();
          } catch (e) {
            reject(e);
          }
          return;
        }
        if (value) {
          chunks.push(Buffer.from(value));
        }
        read();
      }).catch(reject);
    }
    
    read();

    bb.on("file", (name: string, file: any, info: any) => {
      const fileChunks: Buffer[] = [];
      file.on("data", (d: Buffer) => fileChunks.push(d));
      file.on("end", () => {
        try {
          const buf = Buffer.concat(fileChunks);
          files[name] = new File([buf], info.filename || 'unnamed', { type: info.mimeType || 'application/octet-stream' });
        } catch (e) {
          console.error("[Extract] Error creating File object:", e);
        }
      });
    });

    bb.on("field", (name: string, value: any) => {
      fields[name] = value;
    });

    bb.on("finish", () => {
      resolve({ fields, files });
    });

    bb.on("error", (err) => {
      console.error("[Extract] Busboy error:", err);
      reject(err);
    });
  });
}

export async function extractHandler(req: Request): Promise<Response> {
  // Check if this is an AG-UI request (has Accept: text/event-stream header)
  const isAGUIRequest = req.headers.get("Accept") === "text/event-stream";
  
  if (isAGUIRequest) {
    return handleAGUIExtractRequest(req);
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
      console.error("[Extract Handler] FormData parsing error:", parseError);
      // Try direct access as fallback
      try {
        const formData = await req.formData();
        const documentEntry = formData.get("document");
        if (documentEntry instanceof File) {
          file = documentEntry;
        }
        userPrompt = formData.get("prompt")?.toString() || "";
      } catch (fallbackError) {
        console.error("[Extract Handler] Fallback parsing also failed:", fallbackError);
        return createErrorResponse(`Failed to parse form data: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 400);
      }
    }
    
    if (!file) {
      return createErrorResponse("No document provided or invalid file", 400);
    }
    
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
    
    // Return the response in the format expected by project.html
    return new Response(JSON.stringify({
      extracted: extracted,
      templateId: matchedTemplate?.id || null,
      usedTemplate: !!(useTemplateExtraction && matchedTemplate),
      confidence: matchedTemplateResult?.confidence
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Extract Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to extract information from document: " + (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// AG-UI compatible document extraction handler
async function handleAGUIExtractRequest(req: Request): Promise<Response> {
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
            console.error("[AGUI Extract] FormData parsing error:", parseError);
            // Try direct access as fallback
            try {
              const formData = await req.formData();
              const documentEntry = formData.get("document");
              if (documentEntry instanceof File) {
                file = documentEntry;
              }
              userPrompt = formData.get("prompt")?.toString() || "";
            } catch (fallbackError) {
              console.error("[AGUI Extract] Fallback parsing also failed:", fallbackError);
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
            delta: `Starting field extraction for ${file.name}...\n`
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "extracting_text", fileName: file.name }
          }));
          
          const buffer = await file.arrayBuffer();
          
          // Use extractDoc for all file types
          const { originalText, preprocessedText } = await extractDocWithPreprocessing(Buffer.from(buffer), file.name, file.type);
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Analyzing document structure...\n"
          }));
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "matching_template" }
          }));
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Identifying key fields...\n"
          }));
          
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
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "Extracting structured information...\n"
          }));
          
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
          
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: "\nField extraction completed successfully!\n"
          }));
          
          // Send final result
          sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
            type: AGUIEventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: `\nResults:\n${JSON.stringify({
              extracted: result.extracted,
              templateId: result.templateId,
              usedTemplate: result.usedTemplate,
              confidence: (result as any).confidence
            }, null, 2)}\n`
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
            result: {
              extracted: result.extracted,
              templateId: result.templateId,
              usedTemplate: result.usedTemplate,
              confidence: (result as any).confidence
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
    console.error("[AGUI Extract Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to process document extraction with AG-UI protocol" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}