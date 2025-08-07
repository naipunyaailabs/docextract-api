import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Document } from "@langchain/core/documents";
let vectorStore: QdrantVectorStore | null = null;

export async function getVectorStore(): Promise<QdrantVectorStore> {
  if (vectorStore) return vectorStore;

  const client = new QdrantClient({ url: process.env.QDRANT_URL! });
  const embeddings = new OpenAIEmbeddings({ model: "text-embedding-ada-002" });

  vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: "matchedTemplates",
  });

  return vectorStore;
}

export async function resetVectorStore() {
  const store = await getVectorStore();
  // If using QdrantVectorStore, you can drop the collection:
  if (store.client && store.collectionName) {
    await store.client.deleteCollection(store.collectionName);
  }
  // If using another store, use the appropriate method to clear all data.
}