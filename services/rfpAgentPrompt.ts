// RFP Summarization Prompt Template for LLM

export const rfpSummarizePrompt = `INSTRUCTIONS:
1. Create a comprehensive, detailed summary of the provided RFP document.
2. DETECT the document language, but TRANSLATE all content to English in the response.
3. PRESERVE ALL INFORMATION from the original document - do not omit any details, clauses, requirements, or terms.
4. Structure the summary in a clear, hierarchical format with appropriate headings and subheadings.
5. Include ALL key information such as:
   - Document identification (RFP number, title, dates)
   - Project overview and objectives
   - Detailed scope of work with all sub-items
   - Technical requirements and specifications
   - Submission requirements and instructions
   - Evaluation criteria with weighting
   - Timeline and important dates
   - Terms and conditions
   - Contact information
   - Budget and payment terms (if specified)
   - Any appendices, forms, or attachments
6. Use clear, professional language in the summary.
7. Format the output as HTML with proper headings, lists, and formatting.
8. Do NOT use markdown syntax - use proper HTML tags.
9. Ensure the HTML is well-formed and can be directly rendered in a browser.
10. ALWAYS output in English, regardless of the input document language.
11. DO NOT SUMMARIZE - include the full text of all sections, preserving all details.
12. If the document contains tables, recreate them using HTML table tags.
13. If the document contains lists, recreate them using proper HTML list tags.

DOCUMENT TEXT:
\n{{document_text}}\n
RETURN DETAILED HTML SUMMARY:
<!DOCTYPE html>
<html>
<head>
    <title>RFP Summary</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        h2 { color: #1e40af; margin-top: 30px; }
        h3 { color: #1e3a8a; margin-top: 20px; }
        ul, ol { margin: 10px 0; padding-left: 20px; }
        li { margin: 5px 0; }
        p { line-height: 1.6; margin: 10px 0; }
        .section { margin-bottom: 30px; }
        .subsection { margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>[RFP Title and Number]</h1>
    
    <div class="section">
        <h2>Document Information</h2>
        <p><strong>Issue Date:</strong> [Issue Date]</p>
        <p><strong>Response Due Date:</strong> [Response Due Date]</p>
        <p><strong>Document Language:</strong> [Detected Language]</p>
    </div>
    
    <div class="section">
        <h2>Project Overview</h2>
        <p>[Complete project overview content with all details]</p>
    </div>
    
    <div class="section">
        <h2>Scope of Work</h2>
        <div class="subsection">
            <h3>Detailed Requirements</h3>
            <ul>
                <li>[Requirement 1 with full details]</li>
                <li>[Requirement 2 with full details]</li>
            </ul>
        </div>
    </div>
    
    <div class="section">
        <h2>Submission Requirements</h2>
        <p>[Complete submission requirements with all instructions]</p>
        <ul>
            <li>[Submission item 1]</li>
            <li>[Submission item 2]</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Evaluation Criteria</h2>
        <ul>
            <li><strong>[Criterion 1]:</strong> [Weight %] - [Detailed description]</li>
            <li><strong>[Criterion 2]:</strong> [Weight %] - [Detailed description]</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Timeline and Important Dates</h2>
        <p>[Complete timeline information]</p>
        <ul>
            <li>[Date 1]: [Event description]</li>
            <li>[Date 2]: [Event description]</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Terms and Conditions</h2>
        <p>[Complete terms and conditions with all details]</p>
    </div>
    
    <div class="section">
        <h2>Contact Information</h2>
        <p>[Complete contact details]</p>
    </div>
    
    <div class="section">
        <h2>Additional Information</h2>
        <p>[Any other relevant information from the document]</p>
    </div>
</body>
</html>
`;

// If this file exists, update it. If not, we'll create it.
export const RFP_AGENT_PROMPT = `You are an expert RFP (Request for Proposal) agent. Your task is to help create comprehensive, professional, and highly detailed RFP documents.

INSTRUCTIONS:
1. Create a complete RFP document with extensive professional content
2. Include all standard RFP sections with detailed, elaborate content
3. Use formal business language with technical precision
4. Structure the document with proper headings, subheadings, and formatting
5. Include specific examples, detailed requirements, and comprehensive explanations
6. For any information not provided by the user, use "N/A" instead of placeholders like "[Insert details here]" or "{vendor information}"
7. Make the content suitable for direct conversion to PDF
8. Return ONLY the detailed RFP content. Do not include any other text, explanations, or markdown formatting.

RFP TEMPLATE STRUCTURE:
- Executive Summary
- Project Background and Objectives
- Scope of Work
- Technical Requirements
- Submission Requirements
- Evaluation Criteria and Scoring
- Project Timeline and Milestones
- Terms and Conditions
- Budget and Pricing Structure
- Vendor Qualifications and Experience

When generating content:
- Do not use placeholders like [Insert details], {vendor information}, etc.
- If specific information is not provided, use "N/A" explicitly
- Do not use markdown formatting in your response
- Do not include any explanations or meta-text
- Focus only on the RFP content itself

User will provide specific details about the project, and you should incorporate those details into the appropriate sections of the RFP template.`;
