import { groqChatCompletion } from "../utils/groqClient";
import * as docx from "docx";
import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";

export interface RfpSection {
  title: string;
  content: string;
}

export interface RfpContent {
  title: string;
  organization: string;
  deadline: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

// New interface for RFP content with all sections as a single block
export interface RfpContentBlock {
  title: string;
  organization: string;
  deadline: string;
  content: string; // All section content as a single block
}

interface RfpData {
  title: string;
  organization: string;
  deadline: string;
  sections: RfpSection[];
}

const RFP_CREATION_PROMPT = `You are an expert RFP (Request for Proposal) creator. Create a comprehensive, professional, and highly detailed RFP document based on the provided information.

INSTRUCTIONS:
1. Create a complete RFP document with extensive professional content
2. Include all standard RFP sections with detailed, elaborate content
3. Use formal business language with technical precision
4. Structure the document with proper headings, subheadings, and formatting
5. Include specific examples, detailed requirements, and comprehensive explanations
6. For any information not provided, use "Insert [specific information]" format instead of placeholders like "[Insert details here]" or "{vendor information}"
7. CRITICALLY IMPORTANT: For sections with template content like "Provide a comprehensive overview..." or "Detail the background information...", you MUST replace this template content with detailed professional content specific to that section and the provided RFP details
8. Format the content as structured text that can be converted to a Word document
9. Return ONLY the detailed RFP content in structured format. Do not include any other text, explanations, or JSON formatting.

RFP DETAILS:
Title: {{title}}
Organization: {{organization}}
Deadline: {{deadline}}

SECTIONS TO INCLUDE AND ENHANCE:
{{sections}}

RETURN COMPLETE DETAILED RFP CONTENT IN MARKDOWN FORMAT:
`;

export async function createRfp(rfpData: RfpData): Promise<RfpContent> {
  try {
    // Format the sections for the prompt
    const sectionsText = rfpData.sections.map(section => 
      `${section.title}: ${section.content || 'Insert specific content for this section'}`
    ).join('\n');
    
    // Replace placeholders in the prompt
    let prompt = RFP_CREATION_PROMPT
      .replace('{{title}}', rfpData.title || 'Insert RFP title')
      .replace('{{organization}}', rfpData.organization || 'Insert organization name')
      .replace('{{deadline}}', rfpData.deadline || 'Insert response deadline')
      .replace('{{sections}}', sectionsText);
    
    // Log the prompt for debugging
    console.log('[RFPCreator] Sending prompt to LLM with title:', rfpData.title);
    console.log('[RFPCreator] Organization:', rfpData.organization);
    console.log('[RFPCreator] Deadline:', rfpData.deadline);
    console.log('[RFPCreator] Number of sections:', rfpData.sections.length);
    
    // Call the LLM to generate the RFP
    const systemPrompt = "You are an expert RFP (Request for Proposal) creator. Create a comprehensive, professional, and highly detailed RFP document based on the provided information. Format the content as structured text that can be converted to a Word document. Return ONLY the detailed RFP content in structured format without any JSON formatting. For any missing information, use 'Insert [specific information]' format instead of generic placeholders.";
    const response = await groqChatCompletion(systemPrompt, prompt);
    
    // Log the response for debugging
    console.log('[RFPCreator] Received response from LLM, length:', response.length);
    console.log('[RFPCreator] LLM Response preview:', response.substring(0, 1000) + (response.length > 1000 ? '...' : ''));
    
    // Clean up the response to remove any markdown code block formatting
    let content = response.trim();
    if (content.startsWith('```')) {
      content = content.substring(3);
    }
    if (content.endsWith('```')) {
      content = content.substring(0, content.length - 3);
    }
    
    // Log the cleaned content for debugging
    console.log('[RFPCreator] Cleaned content length:', content.length);
    console.log('[RFPCreator] Cleaned content preview:', content.substring(0, 1000) + (content.length > 1000 ? '...' : ''));
    
    // Parse the LLM response to extract enhanced sections
    const enhancedSections = parseMarkdownResponse(content, rfpData.sections);
    
    return {
      title: rfpData.title || 'Insert RFP title',
      organization: rfpData.organization || 'Insert organization name',
      deadline: rfpData.deadline || 'Insert response deadline',
      sections: enhancedSections
    };
  } catch (error) {
    console.error('[RFPCreator] Error creating RFP:', error);
    throw new Error(`Failed to create RFP: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to parse markdown response and extract enhanced sections
export function parseMarkdownResponse(markdownContent: string, originalSections: RfpSection[]): RfpSection[] {
  try {
    // If the content is empty, return original sections
    if (!markdownContent || markdownContent.trim().length === 0) {
      return originalSections.map(section => ({
        title: section.title,
        content: section.content || 'Insert specific content for this section'
      }));
    }
    
    // Split the content into lines
    const lines = markdownContent.split('\n');
    
    // Create a map to store enhanced content for each section
    const sectionContentMap: { [key: string]: string[] } = {};
    
    // Track current section
    let currentSectionTitle: string | null = null;
    let currentSectionContent: string[] = [];
    
    // Process each line
    for (const line of lines) {
      // Check if this line is a heading (section title) - look for ## or ### headings
      const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
      if (headingMatch && headingMatch[1]) {
        // If we were collecting content for a previous section, save it
        if (currentSectionTitle) {
          sectionContentMap[currentSectionTitle] = [...currentSectionContent];
        }
        
        // Start collecting content for the new section
        currentSectionTitle = headingMatch[1].trim();
        currentSectionContent = [];
      } else if (currentSectionTitle) {
        // Add line to current section content, but skip empty lines at the start
        if (currentSectionContent.length > 0 || line.trim() !== '') {
          currentSectionContent.push(line);
        }
      }
    }
    
    // Don't forget to save the last section
    if (currentSectionTitle) {
      sectionContentMap[currentSectionTitle] = currentSectionContent;
    }
    
    // Map original sections to enhanced content
    return originalSections.map(section => {
      // Look for enhanced content by exact title match
      const enhancedContentLines = sectionContentMap[section.title];
      
      // If we found enhanced content, use it; otherwise, use original content
      if (enhancedContentLines && enhancedContentLines.length > 0) {
        const enhancedContent = enhancedContentLines.join('\n').trim();
        return {
          title: section.title,
          content: enhancedContent.length > section.content.length ? enhancedContent : section.content
        };
      }
      
      // Fallback to original content
      return {
        title: section.title,
        content: section.content || 'Insert specific content for this section'
      };
    });
  } catch (error) {
    console.error('[RFPCreator] Error parsing markdown response:', error);
    // Fallback to original sections
    return originalSections.map(section => ({
      title: section.title,
      content: section.content || 'Insert specific content for this section'
    }));
  }
}

// Helper function to create a standard RFP with common sections
export async function createStandardRfp(title: string, organization: string, deadline: string): Promise<RfpContent> {
  const standardSections: RfpSection[] = [
    {
      title: "Executive Summary",
      content: "Provide a comprehensive overview of the project, including its purpose, scope, objectives, and expected outcomes. Explain the business need and the value proposition for responding vendors."
    },
    {
      title: "Project Background and Objectives",
      content: "Detail the background information leading to this RFP, including any relevant history, current challenges, and strategic goals. Clearly define the project objectives and success criteria."
    },
    {
      title: "Scope of Work",
      content: "Define the detailed scope of work including all deliverables, milestones, and outcomes. Specify what is included and excluded from the project scope. Include technical specifications and performance requirements."
    },
    {
      title: "Technical Requirements",
      content: "List all technical specifications, standards, protocols, and requirements for the project. Include hardware, software, integration, security, and compliance requirements. Specify any existing systems that need to be integrated with."
    },
    {
      title: "Submission Requirements",
      content: "Specify detailed requirements for proposal submissions, including format, content, structure, and documentation. Define submission deadlines, methods, and contact information. Include requirements for presentations or demonstrations."
    },
    {
      title: "Evaluation Criteria and Scoring",
      content: "Detail the comprehensive evaluation process, including all criteria and their weightings. Explain how proposals will be scored and ranked. Include technical evaluation, business evaluation, and any presentation components."
    },
    {
      title: "Project Timeline and Milestones",
      content: "Provide a detailed project timeline with key milestones, deadlines, and deliverables. Include phases such as requirements gathering, design, development, testing, deployment, and support. Specify any critical path items."
    },
    {
      title: "Terms and Conditions",
      content: "Include all contractual terms, conditions, legal requirements, and obligations. Cover intellectual property rights, confidentiality, warranties, liability limitations, payment terms, and termination conditions."
    },
    {
      title: "Budget and Pricing Structure",
      content: "Specify the available budget range or request detailed vendor pricing information. Define the required pricing structure, including breakdowns for different components, payment milestones, and any cost escalation clauses."
    },
    {
      title: "Vendor Qualifications and Experience",
      content: "Define the required qualifications, experience, and capabilities for responding vendors. Include requirements for team composition, certifications, past performance, and references. Specify any minimum financial thresholds."
    }
  ];
  
  // For standard RFP, call the LLM to enhance the template content with specific details
  try {
    console.log('[RFPCreator] Creating standard RFP with LLM enhancement for:', title);
    
    // Use the same createRfp function but with standard sections
    const rfpContent = await createRfp({
      title,
      organization,
      deadline,
      sections: standardSections
    });
    
    console.log('[RFPCreator] Standard RFP created with', rfpContent.sections.length, 'enhanced sections');
    return rfpContent;
  } catch (error) {
    console.error('[RFPCreator] Error creating enhanced standard RFP, falling back to template:', error);
    // Fallback to template content if LLM fails
    return {
      title: title || 'Insert RFP title',
      organization: organization || 'Insert organization name',
      deadline: deadline || 'Insert response deadline',
      sections: standardSections
    };
  }
}

// Function to convert RFP content to Word document
export async function createRfpWordDocument(rfpContent: RfpContent): Promise<Uint8Array> {
  // Log the content for debugging
  console.log('[createRfpWordDocument] Received RFP content with', rfpContent.sections.length, 'sections');
  console.log('[createRfpWordDocument] RFP Title:', rfpContent.title);
  console.log('[createRfpWordDocument] RFP Organization:', rfpContent.organization);
  console.log('[createRfpWordDocument] RFP Deadline:', rfpContent.deadline);
  
  try {
    // Format the organization name properly
    const formattedOrganization = formatOrganizationName(rfpContent.organization);
    
    // Create professional markdown content with a clean title page
    let markdownContent = `# ${rfpContent.title}\n\n`;
    markdownContent += `## Request for Proposal\n\n`;
    markdownContent += `**Prepared by:** ${formattedOrganization}\n\n`;
    markdownContent += `**Response Deadline:** ${rfpContent.deadline}\n\n`;
    markdownContent += `---\n\n`;
    
    // Add table of contents
    markdownContent += `## Table of Contents\n\n`;
    rfpContent.sections.forEach((section, index) => {
      markdownContent += `${index + 1}. [${section.title}](#${section.title.toLowerCase().replace(/\s+/g, '-')})\n`;
    });
    markdownContent += `\n---\n\n`;
    
    // Add sections
    rfpContent.sections.forEach((section, index) => {
      // Validate section data
      if (!section.title || !section.content) {
        console.warn('[createRfpWordDocument] Skipping invalid section at index', index, section);
        return;
      }
      
      // Log section content length for debugging
      console.log(`[createRfpWordDocument] Adding section ${index} "${section.title}" to document, content length:`, section.content.length);
      
      // Add section to markdown
      markdownContent += `## ${section.title}\n\n`;
      markdownContent += `${section.content}\n\n`;
    });
    
    // Log the markdown content for debugging
    console.log('[createRfpWordDocument] Generated markdown content length:', markdownContent.length);
    console.log('[createRfpWordDocument] Markdown content preview:', markdownContent.substring(0, 1000) + (markdownContent.length > 1000 ? '...' : ''));
    
    // Convert markdown to DOCX using markdown-docx
    const { default: markdownDocx, Packer } = await import('markdown-docx');
    const doc = await markdownDocx(markdownContent);
    const buffer = await Packer.toBuffer(doc);
    
    console.log('[createRfpWordDocument] Generated Word document buffer size:', buffer.byteLength);
    return buffer;
  } catch (error) {
    console.error('[createRfpWordDocument] Error generating Word document:', error);
    throw new Error(`Failed to generate Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// New function to convert RFP content block to Word document
export async function createRfpWordDocumentFromBlock(rfpContent: RfpContentBlock): Promise<Uint8Array> {
  // Log the content for debugging
  console.log('[createRfpWordDocumentFromBlock] Received RFP content block');
  console.log('[createRfpWordDocumentFromBlock] RFP Title:', rfpContent.title);
  console.log('[createRfpWordDocumentFromBlock] RFP Organization:', rfpContent.organization);
  console.log('[createRfpWordDocumentFromBlock] RFP Deadline:', rfpContent.deadline);
  console.log('[createRfpWordDocumentFromBlock] Content length:', rfpContent.content.length);
  
  try {
    // Format the organization name properly
    const formattedOrganization = formatOrganizationName(rfpContent.organization);
    
    // Create professional markdown content with a clean title page
    let markdownContent = `# ${rfpContent.title}\n\n`;
    markdownContent += `## Request for Proposal\n\n`;
    markdownContent += `**Prepared by:** ${formattedOrganization}\n\n`;
    markdownContent += `**Response Deadline:** ${rfpContent.deadline}\n\n`;
    markdownContent += `---\n\n`;
    
    // Add the entire content block
    markdownContent += rfpContent.content;
    
    // Log the markdown content for debugging
    console.log('[createRfpWordDocumentFromBlock] Generated markdown content length:', markdownContent.length);
    console.log('[createRfpWordDocumentFromBlock] Markdown content preview:', markdownContent.substring(0, 1000) + (rfpContent.content.length > 1000 ? '...' : ''));
    
    // Convert markdown to DOCX using markdown-docx
    const { default: markdownDocx, Packer } = await import('markdown-docx');
    const doc = await markdownDocx(markdownContent);
    const buffer = await Packer.toBuffer(doc);
    
    console.log('[createRfpWordDocumentFromBlock] Generated Word document buffer size:', buffer.byteLength);
    return buffer;
  } catch (error) {
    console.error('[createRfpWordDocumentFromBlock] Error generating Word document:', error);
    throw new Error(`Failed to generate Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to properly capitalize organization names
function formatOrganizationName(orgName: string): string {
  if (!orgName) return orgName;
  
  // Split by spaces and capitalize first letter of each word
  return orgName.split(' ').map(word => {
    if (word.length === 0) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}
