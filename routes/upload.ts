import { extractDoc } from "../services/feildExtractor";
import { storeTemplate } from "../services/templateStore";


export async function uploadHandler(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("document");
  if (!file || !(file instanceof File)) {
    throw new Error("No document file provided");
  }
  const fieldsJson = formData.get("fields")?.toString() || "[]";
  const fields = JSON.parse(fieldsJson);

  const buffer = await file.arrayBuffer();
  const text = await extractDoc(Buffer.from(buffer),file.name,file.type);

  await storeTemplate(text, fields);
  return new Response("Template stored successfully");
}