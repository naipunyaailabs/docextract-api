# RFP Creation Flow Documentation

This document describes the complete flow of RFP creation from user input to Word document output in the Document Summarizer AI application.

## 1. User Interface (Frontend)

### Input Collection
The process begins in the [project.html](file:///c:/Users/cogni/Desktop/docapture-api/project.html) file where users provide RFP details:

1. **Required Fields**:
   - Title
   - Organization
   - Deadline

2. **Optional Sections**:
   - Custom sections with titles and content
   - Standard sections (predefined template)

### JavaScript Event Handling
Located in [project.html](file:///c:/Users/cogni/Desktop/docapture-api/project.html) (lines 603-700):

```javascript
createRfpSubmit.addEventListener('click', async () => {
  // Collect basic RFP information
  const title = document.getElementById('rfpTitle').value;
  const organization = document.getElementById('rfpOrganization').value;
  const deadline = document.getElementById('rfpDeadline').value;

  // Validate required fields
  if (!title || !organization || !deadline) {
    addLog('Please fill in all required fields.');
    return;
  }

  // Collect custom sections
  const sections = [];
  const sectionElements = rfpSectionsContainer.querySelectorAll('.rfp-section');
  sectionElements.forEach(section => {
    const titleInput = section.querySelector('.section-title');
    const contentInput = section.querySelector('.section-content');
    
    // Only include sections that have actual content
    const titleValue = titleInput.value.trim();
    const contentValue = contentInput.value.trim();
    
    // Skip sections that are empty or only contain the placeholder text
    if (titleValue || (contentValue && contentValue !== 'Insert specific content for this section')) {
      sections.push({
        title: titleValue || 'Untitled Section',
        content: contentValue || 'Insert specific content for this section'
      });
    }
  });

  // Prepare request data
  const requestData = {
    title,
    organization,
    deadline
  };
  
  // Only add sections if there are custom sections with actual content
  if (sections.length > 0) {
    requestData.sections = sections;
  }

  // Send request to backend
  const response = await fetch('/create-rfp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer 9bRgWiCIzXStqWs7azssmqEQ'
    },
    body: JSON.stringify(requestData)
  });
  
  // Handle response...
});
```

## 2. API Route Handler

### Route: `/create-rfp`
Located in [routes/createRfp.ts](file:///c:/Users/cogni/Desktop/docapture-api/routes/createRfp.ts):

```typescript
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
    
    let rfpContent: RfpContent;
    
    // Decision point: Custom RFP vs Standard RFP
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
    
    // Generate Word document
    const wordBuffer = await createRfpWordDocument(rfpContent);
    
    // Return the generated Word document
    return new Response(wordBuffer, { 
      headers: { 
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${requestData.title.replace(/\s+/g, '_')}_RFP.docx"`
      } 
    });
  } catch (error: any) {
    // Error handling...
  }
}
```

## 3. RFP Creation Service

### Custom RFP Creation
Located in [services/rfpCreator.ts](file:///c:/Users/cogni/Desktop/docapture-api/services/rfpCreator.ts):

```typescript
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
    
    // Call the LLM to generate the RFP
    const systemPrompt = "You are an expert RFP (Request for Proposal) creator...";
    const response = await groqChatCompletion(systemPrompt, prompt);
    
    // Log the response for debugging
    console.log('[RFPCreator] Received response from LLM, length:', response.length);
    
    // Clean up the response
    let content = response.trim();
    if (content.startsWith('```')) {
      content = content.substring(3);
    }
    if (content.endsWith('```')) {
      content = content.substring(0, content.length - 3);
    }
    
    // Enhance the original sections with more meaningful content
    const enhancedSections = rfpData.sections.map(section => {
      // If the section content is just the placeholder, provide more detailed placeholder content
      if (section.content === 'Insert specific content for this section') {
        return {
          title: section.title,
          content: `Please provide detailed information for the ${section.title} section. Include specific requirements, objectives, deliverables, timelines, and any other relevant details that would help vendors understand what is expected.`
        };
      }
      return section;
    });
    
    return {
      title: rfpData.title || 'Insert RFP title',
      organization: rfpData.organization || 'Insert organization name',
      deadline: rfpData.deadline || 'Insert response deadline',
      sections: enhancedSections
    };
  } catch (error) {
    // Error handling...
  }
}
```

### Standard RFP Creation
Located in [services/rfpCreator.ts](file:///c:/Users/cogni/Desktop/docapture-api/services/rfpCreator.ts):

```typescript
export async function createStandardRfp(title: string, organization: string, deadline: string): Promise<RfpContent> {
  const standardSections: RfpSection[] = [
    {
      title: "Executive Summary",
      content: "Provide a comprehensive overview..."
    },
    // ... other standard sections
  ];
  
  // Return predefined sections directly (no LLM call)
  return {
    title: title || 'Insert RFP title',
    organization: organization || 'Insert organization name',
    deadline: deadline || 'Insert response deadline',
    sections: standardSections
  };
}
```

## 4. LLM Integration

### Groq Client
Located in [utils/groqClient.ts](file:///c:/Users/cogni/Desktop/docapture-api/utils/groqClient.ts):

```typescript
export async function groqChatCompletion(
  system: string,
  user: string,
  imageBase64?: string,
  imageMimeType: string = "image/jpeg"
): Promise<string> {
  const model = 'meta-llama/llama-4-scout-17b-16e-instruct';

  try {
    const messages = createMessages(system, user, imageBase64, imageMimeType);

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model,
      temperature: 0.6,
      max_tokens: 4096,
      top_p: 0.95,
      stream: true,
      stop: null
    });

    const result = await processChatCompletionStream(chatCompletion);
    return result;
  } catch (error) {
    // Error handling...
  }
}
```

## 5. Word Document Generation

### Document Creation
Located in [services/rfpCreator.ts](file:///c:/Users/cogni/Desktop/docapture-api/services/rfpCreator.ts):

```typescript
export async function createRfpWordDocument(rfpContent: RfpContent): Promise<Uint8Array> {
  try {
    // Create document using docx library
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: rfpContent.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          // Organization
          new Paragraph({
            children: [
              new TextRun({
                text: `Organization: ${rfpContent.organization}`,
                bold: true,
              }),
            ],
          }),
          // Deadline
          new Paragraph({
            children: [
              new TextRun({
                text: `Response Deadline: ${rfpContent.deadline}`,
                bold: true,
                color: "FF0000", // Red in hex format
              }),
            ],
          }),
          new Paragraph({}),
          // Sections
          ...rfpContent.sections.flatMap((section, index) => {
            return [
              new Paragraph({
                text: section.title,
                heading: index === 0 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
              }),
              new Paragraph({
                text: section.content,
                spacing: {
                  after: 200,
                },
              }),
            ];
          }),
        ],
      }],
    });

    // Generate buffer
    const buffer = await docx.Packer.toBuffer(doc);
    return buffer;
  } catch (error) {
    // Error handling...
  }
}
```

## 6. Response Handling

### Frontend Response Processing
Back in [project.html](file:///c:/Users/cogni/Desktop/docapture-api/project.html):

```javascript
// Get the Word document response as blob
const blob = await response.blob();

// Create download link
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${title.replace(/\s+/g, '_')}_RFP.docx`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

## Flow Summary

1. **User Input**: User fills RFP form with title, organization, deadline, and optional custom sections
2. **Request Preparation**: JavaScript collects data and prepares JSON request
3. **API Call**: POST request sent to `/create-rfp` endpoint
4. **Route Handling**: Server validates input and decides between custom or standard RFP
5. **LLM Processing** (Custom RFP only): 
   - Prompt constructed with user data
   - Request sent to Groq LLM API
   - Response received and cleaned
6. **Content Enhancement**: Original sections enhanced with more meaningful placeholder content
7. **Document Generation**: Word document created using docx library
8. **Response**: Word document returned as downloadable blob
9. **Download**: User receives .docx file

## Key Design Decisions

1. **Simplified Approach**: Uses enhanced original section content instead of parsing complex LLM responses
2. **Standard RFP Efficiency**: Standard RFPs return predefined sections without LLM calls
3. **Error Handling**: Comprehensive error handling at each step
4. **Logging**: Detailed logging for debugging and monitoring
5. **Validation**: Input validation at both frontend and backend

## Error Handling Points

1. **Frontend Validation**: Required fields check
2. **Backend Validation**: Request data validation
3. **LLM Errors**: Error handling in groqClient
4. **Document Generation Errors**: Error handling in createRfpWordDocument
5. **API Route Errors**: General error handling in createRfpHandler

## Current Implementation Status

The current implementation successfully:
- Calls the LLM for custom RFPs
- Receives enhanced content from the LLM
- Enhances placeholder content with more meaningful text
- Generates Word documents with proper formatting
- Handles errors gracefully

Future improvements could include:
- Parsing the actual LLM response content to use enhanced section content
- More sophisticated markdown parsing
- Better matching of LLM-generated sections with original sections