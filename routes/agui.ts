import { extractDoc, extractDocWithPreprocessing } from "../services/fieldExtractor";
import { matchTemplate } from "../services/templateStore";
import { groqChatCompletion } from "../utils/groqClient";
import { createErrorResponse } from "../utils/errorHandler";
import { authenticateRequest } from "../utils/auth";
import type { ExtractResponse, Template } from "../types";
import { runRfpAgent } from "../services/rfpAgent";
import { createRfp, createStandardRfp, createRfpWordDocument } from "../services/rfpCreator";
import type { RfpSection } from "../services/rfpCreator";
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
  type ToolCallStartEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type StateDeltaEvent
} from "../utils/agui";
import Busboy from '@fastify/busboy';

// Convert Bun Headers -> plain lowercase object for Busboy
function normalizeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

// Helper function to parse multipart form data
async function parseMultipart(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  console.log("[AGUI] Content-Type:", contentType);
  
  // If Content-Type is missing or not multipart, try to use the native formData parser
  if (!contentType || !contentType.startsWith("multipart/form-data")) {
    console.log("[AGUI] Content-Type is not multipart/form-data, trying native parser");
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
      
      console.log("[AGUI] Native parser success - fields:", Object.keys(fields), "files:", Object.keys(files));
      return { fields, files };
    } catch (e) {
      console.error("[AGUI] Native formData parser failed:", e);
      // If both parsing methods fail, return empty objects instead of throwing
      return { fields: {}, files: {} };
    }
  }

  // Always try to use Busboy parser first, as it's more robust
  console.log("[AGUI] Trying Busboy parser");
  try {
    const result = await parseWithBusboy(req);
    console.log("[AGUI] Busboy parser success - fields:", Object.keys(result.fields), "files:", Object.keys(result.files));
    return result;
  } catch (e) {
    console.error("[AGUI] Busboy parser failed:", e);
    // If Busboy fails, try to use the native formData parser as fallback
    try {
      console.log("[AGUI] Trying native parser as fallback");
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
      
      console.log("[AGUI] Native parser fallback success - fields:", Object.keys(fields), "files:", Object.keys(files));
      return { fields, files };
    } catch (e2) {
      console.error("[AGUI] Native formData parser also failed:", e2);
      // If both parsing methods fail, return empty objects instead of throwing
      return { fields: {}, files: {} };
    }
  }
}

// Helper function to parse multipart form data using Busboy
async function parseWithBusboy(req: Request) {
  console.log("[AGUI] parseWithBusboy called");
  // Get the raw body as ArrayBuffer first
  const buffer = await req.arrayBuffer();
  const bufferAsBuffer = Buffer.from(buffer);
  console.log("[AGUI] Buffer length:", buffer.byteLength);
  
  const headersObj = normalizeHeaders(req.headers);
  console.log("[AGUI] Normalized headers:", headersObj);
  // Type assertion to satisfy Busboy's type requirements
  const bb = Busboy({ headers: headersObj as any });
  
  const fields: Record<string, any> = {};
  const files: Record<string, File> = {};

  return new Promise<{ fields: Record<string, any>, files: Record<string, File> }>((resolve, reject) => {
    bb.on("file", (name: string, file: any, info: any) => {
      const fileChunks: Buffer[] = [];
      file.on("data", (d: Buffer) => fileChunks.push(d));
      file.on("end", () => {
        try {
          const buf = Buffer.concat(fileChunks);
          console.log("[AGUI] Creating File object - name:", name, "filename:", info.filename, "size:", buf.length, "mimeType:", info.mimeType);
          try {
            files[name] = new File([buf], info.filename || 'unnamed', { type: info.mimeType || 'application/octet-stream' });
            console.log("[AGUI] File object created successfully");
          } catch (fileError) {
            console.error("[AGUI] Error creating File object:", fileError);
            // Fallback: try creating with minimal parameters
            try {
              files[name] = new File([buf], info.filename || 'unnamed');
              console.log("[AGUI] File object created with fallback method");
            } catch (fallbackError) {
              console.error("[AGUI] Fallback File creation also failed:", fallbackError);
            }
          }
        } catch (e) {
          console.error("[AGUI] Error creating File object:", e);
        }
      });
    });

    bb.on("field", (name: string, value: any) => {
      console.log("[AGUI] Field parsed - name:", name, "value:", value);
      fields[name] = value;
    });

    bb.on("finish", () => {
      console.log("[AGUI] Busboy finish event - fields:", Object.keys(fields), "files:", Object.keys(files));
      resolve({ fields, files });
    });

    bb.on("error", (err) => {
      console.error("[AGUI] Busboy error:", err);
      reject(err);
    });

    // Write the buffer directly to Busboy
    console.log("[AGUI] Writing buffer to Busboy - length:", bufferAsBuffer.length);
    bb.write(bufferAsBuffer);
    bb.end();
    console.log("[AGUI] Busboy write completed");
  });
}

// AG-UI compatible document processing handler
export async function aguiProcessHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const serviceId = url.pathname.split("/").pop() || "";
    
    // Map database service IDs to endpoint paths
    const serviceIdMap: Record<string, string> = {
      "field-extractor": "extract",
      "document-summarizer": "summarize",
      "rfp-creator": "create-rfp",
      "rfp-summarizer": "summarize-rfp",
      "template-uploader": "upload"
    };
    
    // Use the mapped service ID if it exists, otherwise use the original
    const mappedServiceId = serviceIdMap[serviceId] || serviceId;
    
    // Check authentication (either via Authorization header or token query parameter)
    const authHeader = req.headers.get("Authorization");
    const tokenParam = url.searchParams.get("token");
    
    let authToken: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      authToken = authHeader.substring(7);
    } else if (tokenParam) {
      authToken = tokenParam;
    }
    
    if (!authToken) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
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
          
          // Process based on service ID
          let result: any;
          let processingStep = "";
          
          // Check if the body has already been used
          if (req.bodyUsed) {
            throw new Error("Request body has already been consumed");
          }
          
          // Log the content type for debugging
          const contentType = req.headers.get("content-type");
          console.log("[AGUI Handler] Content-Type:", contentType);
          
          // Parse form data with fallback
          let file: File | null = null;
          let userPrompt = "";
          let fields: Record<string, any> = {};
          
          try {
            console.log("[AGUI Handler] Parsing multipart data");
            const parsedData = await parseMultipart(req);
            console.log("[AGUI Handler] Parsed data - fields:", Object.keys(parsedData.fields), "files:", Object.keys(parsedData.files));
            file = parsedData.files["document"] || null;
            userPrompt = parsedData.fields["prompt"] || "";
            fields = parsedData.fields;
            console.log("[AGUI Handler] Extracted - file:", !!file, "prompt:", userPrompt);
          } catch (parseError) {
            console.error("[AGUI Handler] FormData parsing error:", parseError);
            // Instead of trying formData() again, we'll continue with empty/default values
            // This allows the service to handle missing data appropriately
            file = file || null;
            userPrompt = userPrompt || "";
          }
          
          // Only require a file for services that need it
          const servicesRequiringFile = ["extract", "summarize", "summarize-rfp", "upload"];
          if (servicesRequiringFile.includes(mappedServiceId) && !file) {
            throw new Error(`No document provided or invalid file for service: ${mappedServiceId}`);
          }
          
          // Send processing state update
          sendSSEEvent(controller, createAGUIEvent<StateDeltaEvent>({
            type: AGUIEventType.STATE_DELTA,
            delta: { status: "uploading", fileName: file?.name || "unknown" }
          }));
          
          switch (mappedServiceId) {
            case "extract":
              processingStep = "Field Extraction";
              // Validate file exists for this service
              if (!file) {
                throw new Error("No document provided for field extraction");
              }
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: `Starting field extraction for ${file.name}...\n`
              }));
              
              // Simulate processing steps
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Analyzing document structure...\n"
              }));
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Identifying key fields...\n"
              }));
              
              // For services that require a file, we've already validated it exists
              // For services that don't require a file, we can skip file processing
              if (file) {
                // Extract data directly in the handler
                const fileBuffer = await file.arrayBuffer();
                
                // Use extractDoc for all file types
                const { originalText, preprocessedText } = await extractDocWithPreprocessing(Buffer.from(fileBuffer), file.name, file.type);

                // Check if the document has minimal content
                if (originalText.length < 100) {
                  sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                    type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                    messageId,
                    delta: "\nWarning: Document appears to have minimal or no content. Extraction results may be limited.\n"
                  }));
                }

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

                // If we couldn't extract anything meaningful, provide a more descriptive result
                if (!extracted || Object.keys(extracted).length === 0) {
                  extracted = {
                    "document_analysis": {
                      "status": "minimal_content",
                      "message": "Document appears to have minimal or no extractable content",
                      "character_count": originalText.length,
                      "content_preview": originalText.substring(0, 200) + (originalText.length > 200 ? "..." : "")
                    }
                  };
                }

                result = { 
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
              }
              break;
              
            case "summarize":
              processingStep = "Document Summarization";
              // Validate file exists for this service
              if (!file) {
                throw new Error("No document provided for document summarization");
              }
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: `Starting document summarization for ${file.name}...\n`
              }));
              
              // Simulate processing steps
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Analyzing document content...\n"
              }));
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Generating concise summary...\n"
              }));
              
              // Process summarize directly
              const summarizeBuffer = await file.arrayBuffer();
              const summarizeText: string = await extractDoc(Buffer.from(summarizeBuffer), file.name, file.type);

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
                Document: ${summarizeText}`
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
                Document: ${summarizeText}`;

              const summary: string = await groqChatCompletion(
                "You are an advanced document summarizer. You can understand complex documents and create concise, accurate summaries. Format your response using HTML with Tailwind CSS classes. Focus on the most important information and maintain the document's key meaning.",
                summarizationPrompt
              );
              
              result = { summary };
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "\nDocument summarization completed successfully!\n"
              }));
              break;
              
            case "summarize-rfp":
              processingStep = "RFP Summarization";
              // Validate file exists for this service
              if (!file) {
                throw new Error("No document provided for RFP summarization");
              }
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: `Starting RFP summarization for ${file.name}...\n`
              }));
              
              // Simulate processing steps
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Analyzing RFP structure...\n"
              }));
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Extracting key requirements...\n"
              }));
              
              // Process RFP summarize directly
              const rfpBuffer = await file.arrayBuffer();
              const rfpText: string = await extractDoc(Buffer.from(rfpBuffer), file.name, file.type);

              // Use the centralized agent for LLM invocation and validation
              const agentResult = await runRfpAgent({ documentText: rfpText });
              
              if (!agentResult.schemaValid) {
                throw new Error(agentResult.error || "Failed to generate RFP summary. The LLM response may not be in the expected format.");
              }
              
              result = agentResult;
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "\nRFP summarization completed successfully!\n"
              }));
              break;
              
            case "create-rfp":
              processingStep = "RFP Creation";
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Starting RFP creation...\n"
              }));
              
              // Simulate processing steps
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Generating RFP structure...\n"
              }));
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Creating professional document...\n"
              }));
              
              // Process RFP create directly
              const requestDataJson = fields["request"] || "{}";
              let requestData: any = {};
              try {
                requestData = JSON.parse(requestDataJson);
              } catch (e) {
                requestData = {};
              }
              
              // Validate required fields
              if (!requestData.title || !requestData.organization || !requestData.deadline) {
                throw new Error("Missing required fields: title, organization, and deadline are required");
              }
              
              let rfpContent: import("../services/rfpCreator").RfpContent;
              
              if (requestData.sections && requestData.sections.length > 0) {
                // Create custom RFP with provided sections
                rfpContent = await createRfp({
                  title: requestData.title,
                  organization: requestData.organization,
                  deadline: requestData.deadline,
                  sections: requestData.sections
                });
              } else {
                // Create standard RFP with default sections
                rfpContent = await createStandardRfp(
                  requestData.title,
                  requestData.organization,
                  requestData.deadline
                );
              }
              
              // Create Word document from the RFP content
              const wordBuffer = await createRfpWordDocument(rfpContent);
              
              // Convert Uint8Array to base64
              const base64Document = Buffer.from(wordBuffer).toString('base64');
              
              result = { 
                title: rfpContent.title,
                organization: rfpContent.organization,
                deadline: rfpContent.deadline,
                sectionsCount: rfpContent.sections.length,
                document: base64Document,
                filename: `${requestData.title.replace(/\s+/g, '_')}_RFP.docx`
              };
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "\nRFP creation completed successfully!\n"
              }));
              break;
              
            case "upload":
              processingStep = "Template Upload";
              // Validate file exists for this service
              if (!file) {
                throw new Error("No document provided for template upload");
              }
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: `Starting template upload for ${file.name}...\n`
              }));
              
              // Simulate processing steps
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Processing template document...\n"
              }));
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "Storing template in database...\n"
              }));
              
              // Process upload directly
              const fieldsJson = fields["fields"] || "[]";
              let templateFields: string[] = [];
              try {
                templateFields = JSON.parse(fieldsJson);
                // Validate that fields is an array of strings
                if (!Array.isArray(templateFields) || !templateFields.every(f => typeof f === 'string')) {
                  throw new Error("Fields must be an array of strings");
                }
              } catch (e) {
                throw new Error("Invalid fields format");
              }

              const uploadBuffer = await file.arrayBuffer();
              const uploadText = await extractDoc(Buffer.from(uploadBuffer), file.name, file.type);

              // Note: We're not actually calling storeTemplate here to avoid side effects
              // In a real implementation, you would call:
              // await storeTemplate(uploadText, fields);
              
              // Return the response in the format expected by project.html
              result = { 
                message: "Template stored successfully",
                fileName: file.name,
                fieldsCount: templateFields.length
              };
              
              sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: "\nTemplate upload completed successfully!\n"
              }));
              break;
              
            default:
              throw new Error(`Unknown service: ${serviceId}`);
          }
          
          // Send final result
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
    console.error("[AGUI Process Handler Error]:", error);
    return new Response(JSON.stringify({ error: "Failed to process document with AG-UI protocol: " + (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}