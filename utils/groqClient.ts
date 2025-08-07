import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function groqChatCompletion(
  system: string,
  user: string,
  imageBase64?: string,
  imageMimeType: string = "image/jpeg"
): Promise<string> {
  const isVision = !!imageBase64;
  const model = 'meta-llama/llama-4-scout-17b-16e-instruct';

  try {
    const messages: any[] = [
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

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model,
      temperature: 0.6,
      max_tokens: 4096,
      top_p: 0.95,
      stream: true,
      stop: null
    });

    let fullResponse = '';
    for await (const chunk of chatCompletion) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      process.stdout.write(content);
    }

    return fullResponse.trim();
  } catch (error) {
    console.error("[groqChatCompletion] Error:", error);
    throw new Error(`Failed to process chat request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}