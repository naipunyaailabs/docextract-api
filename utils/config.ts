/**
 * Configuration utility for managing environment variables
 */

// API Keys
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const API_KEY = process.env.API_KEY || '';

// Service URLs
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Application Settings
export const PORT = parseInt(process.env.PORT || '5000', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Validates required configuration values
 * @throws Error if required configuration is missing
 */
export function validateConfig(): void {
  const requiredKeys = [
    { name: 'GROQ_API_KEY', value: GROQ_API_KEY }
  ];

  const missingKeys = requiredKeys.filter(key => !key.value);
  
  if (missingKeys.length > 0) {
    const missingNames = missingKeys.map(key => key.name).join(', ');
    throw new Error(`Missing required environment variables: ${missingNames}`);
  }
}

/**
 * Gets a masked version of an API key for logging
 * @param apiKey The API key to mask
 * @returns Masked API key (first 4 chars + ****)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  return `${apiKey.substring(0, 4)}****`;
}

/**
 * Logs the current configuration (with masked keys)
 */
export function logConfig(): void {
  console.log('Configuration:');
  console.log(`  OPENAI_API_KEY: ${maskApiKey(OPENAI_API_KEY)}`);
  console.log(`  GROQ_API_KEY: ${maskApiKey(GROQ_API_KEY)}`);
  console.log(`  API_KEY: ${maskApiKey(API_KEY)}`);
  console.log(`  OLLAMA_BASE_URL: ${OLLAMA_BASE_URL}`);
  console.log(`  PORT: ${PORT}`);
  console.log(`  NODE_ENV: ${NODE_ENV}`);
}