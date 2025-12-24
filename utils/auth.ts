import { NODE_ENV } from "./config";

/**
 * Validates API key from Authorization header
 * @param req - The incoming request
 * @returns boolean indicating if the API key is valid
 */
export function validateApiKey(req: Request): boolean {
  // In a production environment, you would typically check against a database or environment variable
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  
  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
  const validApiKey = process.env.API_KEY;
  
  // Fail closed in non-development environments if API_KEY is not configured
  if (!validApiKey) {
    if (NODE_ENV !== "development") {
      console.error("API_KEY is not configured; rejecting request in non-development environment");
      return false;
    }

    console.warn("No API_KEY configured in environment variables. Authentication is disabled in development mode.");
    return true;
  }
  
  return apiKey === validApiKey;
}

/**
 * Middleware function to protect routes with API key authentication
 * @param req - The incoming request
 * @returns Response with 401 error if authentication fails, null if successful
 */
export function authenticateRequest(req: Request): Response | null {
  // Allow OPTIONS preflight requests without authentication
  if (req.method === "OPTIONS") {
    return null;
  }
  
  if (!validateApiKey(req)) {
    return new Response(
      JSON.stringify({ 
        error: "Unauthorized", 
        message: "Invalid or missing API key" 
      }), 
      { 
        status: 401, 
        headers: { 
          "Content-Type": "application/json",
          "WWW-Authenticate": "Bearer realm=\"API Key Required\"" 
        } 
      }
    );
  }
  
  return null; // Authentication successful
}