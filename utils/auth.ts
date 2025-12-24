import { NODE_ENV } from "./config";
import sessionService from "../services/sessionService";

/**
 * Validates a specific token against system API key or User Sessions
 * @param token - The token string to validate
 * @returns boolean indicating if the token is valid
 */
export async function validateToken(token: string): Promise<boolean> {
  const validApiKey = process.env.API_KEY;
  
  // 1. Check if it matches the System API Key
  if (validApiKey && token === validApiKey) {
    return true;
  }

  // 2. Check if it is a valid User Session Token
  const userId = await sessionService.getUserIdFromToken(token);
  if (userId) {
    return true;
  }
  
  // Fail closed in non-development environments if API_KEY is not configured
  if (!validApiKey) {
    if (NODE_ENV !== "development") {
      console.error("API_KEY is not configured; rejecting request in non-development environment");
      return false;
    }

    console.warn("No API_KEY configured in environment variables. Authentication is disabled in development mode.");
    return true;
  }
  
  return false;
}

/**
 * Validates API key or Session Token from Authorization header
 * @param req - The incoming request
 * @returns boolean indicating if the request is authenticated
 */
export async function validateApiKey(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  return validateToken(token);
}

/**
 * Middleware function to protect routes with API key authentication
 * @param req - The incoming request
 * @returns Response with 401 error if authentication fails, null if successful
 */
export async function authenticateRequest(req: Request): Promise<Response | null> {
  // Allow OPTIONS preflight requests without authentication
  if (req.method === "OPTIONS") {
    return null;
  }
  
  if (!(await validateApiKey(req))) {
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