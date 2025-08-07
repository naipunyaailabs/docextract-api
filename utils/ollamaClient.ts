import axios from "axios";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export async function ollamaChat(
  system: string,
  user: string,
  imageBase64?: string,
  imageMimeType: string = "image/jpeg"
): Promise<string> {
  const isVision = !!imageBase64;
  // Use 'llava' for vision, or 'mistral' for text
  const model = "mistral:7b-instruct";

  try {
    const messages: any[] = [
      { role: "system", content: system },
      {
        role: "user",
        content: user,
      },
    ];

    // If vision, add image to the prompt
    if (isVision && imageBase64) {
      messages[1].images = [imageBase64];
    }

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model,
        messages,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 4096,
        },
      },
      { timeout: 1200000 }
    );

    const content = response.data?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }

    return content.trim();
  } catch (error) {
    console.error("[ollamaChat] Error:", error);
    throw new Error(`Failed to process chat request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}