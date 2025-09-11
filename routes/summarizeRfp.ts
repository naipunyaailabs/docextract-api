import { extractDoc } from "../services/fieldExtractor";
import { runRfpAgent } from "../services/rfpAgent";

// RFP JSON Summarization API handler
export async function summarizeRfpHandler(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get("document");
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No document provided or invalid file" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const buffer = await file.arrayBuffer();
    const text: string = await extractDoc(Buffer.from(buffer), file.name, file.type);

    // Use the centralized agent for LLM invocation and validation
    const agentResult = await runRfpAgent({ documentText: text });

    if (!agentResult.schemaValid) {
      return new Response(JSON.stringify({ error: agentResult.error || "Failed to validate RFP schema", llmOutput: agentResult.raw }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ result: agentResult.parsed }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to summarize RFP" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}