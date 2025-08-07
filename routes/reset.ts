import { resetVectorStore } from "../services/vectorStore";

export default async function (req: Request): Promise<Response> {
  await resetVectorStore();
  return Response.json({ success: true, message: "All collections reset." });
}
