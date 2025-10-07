import { createRfp, createStandardRfp, createRfpWordDocument } from "../services/rfpCreator";
import type { RfpSection } from "../services/rfpCreator";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";

interface CreateRfpRequest {
  title: string;
  organization: string;
  deadline: string;
  sections?: RfpSection[];
}

export async function createRfpHandler(req: Request): Promise<Response> {
  try {
    // Get JSON data from request
    const requestData = await req.json() as CreateRfpRequest;
    
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
      
      // Log the buffer size for debugging
      console.log('[CreateRfpHandler] Generated Word document buffer size:', wordBuffer.byteLength);
      
      // Return a JSON response indicating success with file info
      const formattedResponse = {
        success: true,
        data: {
          result: {
            message: "RFP document created successfully",
            fileName: `${requestData.title.replace(/\s+/g, '_')}_RFP.docx`,
            fileSize: wordBuffer.byteLength
          },
          logs: []
        }
      };
      return createSuccessResponse(formattedResponse);
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