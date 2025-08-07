import { extractDoc } from "../services/feildExtractor";
import { matchTemplate } from "../services/templateStore";
import { groqChatCompletion } from "../utils/groqClient";

export async function extractHandler(req: Request): Promise<Response> {
  // Get form data
  const formData = await req.formData();
  
  // Get file from form data
  const file = formData.get("document");
  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No document provided or invalid file" }), { status: 400 });
  }
  
  // Get user prompt from form data
  const userPrompt = formData.get("prompt")?.toString() || "";
  const buffer = await file.arrayBuffer();
  
  // Use extractDoc for all file types
  const text = await extractDoc(Buffer.from(buffer), file.name, file.type);

  // Optionally: Perform template matching and/or field/generic extraction downstream
  const matchedTemplate = await matchTemplate(text);
  const getExtractionPrompt = (docContent: string) => {
    if (matchedTemplate) {
      return `Extract the following fields from the document: ${matchedTemplate.fields.join(", ")}. Respond ONLY with valid JSON. Do not include explanations, comments, or extra text. The response MUST start with '{' and end with '}'. If you cannot find a field, use null as its value. Document: ${docContent}`;
    } else if (userPrompt.trim()) {
      return `Extract the information described by the user from the document: \"${userPrompt}\" Respond ONLY with valid JSON. Document: ${docContent}`;
    } else {
      return `Extract all key-value pairs, dates, names, organizations, and any other structured information from the following document. Respond ONLY with valid JSON. Document: ${docContent}`;
    }
  };

  const extractionPrompt = getExtractionPrompt(text);
  const response = await groqChatCompletion(
    "You are an advanced document parser and contextual extractor. You deeply understand document structures and can extract both explicit and implicit information. Respond ONLY with valid JSON.",
    extractionPrompt
  );

  let extracted = null;
  try {
    const firstBrace = response.indexOf("{");
    const lastBrace = response.lastIndexOf("}");
    extracted = (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace)
      ? JSON.parse(response.slice(firstBrace, lastBrace + 1)) : null;
  } catch {
    extracted = null;
  }

  return new Response(
    JSON.stringify({ extracted, templateId: matchedTemplate?.id || null, usedTemplate: !!matchedTemplate }),
    { headers: { "Content-Type": "application/json" } }
  );
}