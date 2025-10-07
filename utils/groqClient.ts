import { Groq } from 'groq-sdk';
import { Stream } from 'stream';
import type { 
  ChatCompletionContentPart, 
  ChatCompletionSystemMessageParam, 
  ChatCompletionUserMessageParam,
  ChatCompletionMessageParam
} from 'groq-sdk/resources/chat/completions';

// Type definitions
type MessageContent = ChatCompletionContentPart;

type ChatMessage = ChatCompletionMessageParam;

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

/**
 * Creates the messages array for the chat completion
 * @param system The system prompt
 * @param user The user prompt
 * @param imageBase64 Optional base64 encoded image
 * @param imageMimeType The MIME type of the image
 * @returns Array of chat messages
 */
function createMessages(
  system: string, 
  user: string, 
  imageBase64?: string, 
  imageMimeType: string = "image/jpeg"
): ChatMessage[] {
  const isVision = !!imageBase64;
  
  return [
    { role: "system", content: system },
    isVision && imageBase64
      ? {
          role: "user",
          content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } }
          ]
        }
      : { role: "user", content: user },
  ];
}

/**
 * Processes the chat completion stream and returns the full response
 * @param chatCompletion The chat completion stream
 * @returns The full response text
 */
async function processChatCompletionStream(chatCompletion: AsyncIterable<any>): Promise<string> {
  let fullResponse = '';
  for await (const chunk of chatCompletion) {
    const content = chunk.choices[0]?.delta?.content || '';
    fullResponse += content;
    process.stdout.write(content);
  }
  return fullResponse.trim();
}

/**
 * Handles errors from the Groq API
 * @param error The error object
 * @returns Formatted error message
 */
function handleGroqError(error: unknown): string {
  console.error("[groqChatCompletion] Error:", error);
  return `Failed to process chat request: ${error instanceof Error ? error.message : 'Unknown error'}`;
}

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
    
    // Log the result for debugging
    console.log('[groqChatCompletion] Generated response length:', result.length);
    
    return result;
  } catch (error) {
    console.error('[groqChatCompletion] Error:', error);
    throw new Error(handleGroqError(error));
  }
}