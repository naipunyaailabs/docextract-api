import { franc } from 'franc';

/**
 * Detects the language of a text buffer
 * @param buffer The text buffer to analyze
 * @returns Promise resolving to language code and confidence score
 */
export async function detectLanguage(buffer: Buffer): Promise<{ language: string; score: number }> {
  try {
    // Convert buffer to string
    const text = buffer.toString('utf-8');
    
    // Use franc to detect language
    // franc returns the language code directly
    const language = franc(text);
    
    // If franc can't detect the language, return 'unknown'
    if (language === 'und') {
      return { language: 'unknown', score: 0 };
    }
    
    // For franc, we'll use a fixed confidence score of 0.9 for now
    // In a more sophisticated implementation, we could use franc-all which provides probabilities
    return { language, score: 0.9 };
  } catch (error) {
    console.error('[Language Detection] Error:', error);
    return { language: 'unknown', score: 0 };
  }
}