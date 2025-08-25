// utils/openaiClient.ts
import OpenAI from "openai";
import { OPENAI_API_KEY } from "../utils/config";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

export async function getOpenAIEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  if (!res.data?.[0]?.embedding) {
    return [];
  }
  return res.data[0].embedding;
}