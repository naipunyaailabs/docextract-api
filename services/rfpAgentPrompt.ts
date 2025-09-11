// RFP Summarization Prompt Template for LLM

export const rfpSummarizePrompt = `INSTRUCTIONS:
1. Extract every possible detail, requirement, clause, deliverable, provision, submission instruction, date, annex, form, and piece of relevant information from the provided RFP text.
2. The RFP may be in any language. Detect the document language, and do not omit any information.
3. Structure the output as a deeply nested JSON object, preserving all content organization, headings, and lists (use arrays for lists, objects for sections).
4. Do not leave out miscellaneous notes, special terms, figures, notes, or small print.
5. Do NOT summarize or paraphrase—include the full text and substructure of every section, even if repetitive or unstructured.
6. If sections are blank or missing, return an empty string or array for that field, but do not skip any portion present in the text.
7. Respond ONLY with valid JSON, no prose or markdown.

DOCUMENT TEXT:
\n{{document_text}}\n
RETURN JSON:
{
  "language_detected": "<document_language>",
  "sections": [
    // Extracted sections, sub-sections, and all contents go here, preserving depth and numbering
  ]
}
`;