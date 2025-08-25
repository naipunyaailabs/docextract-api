/**
 * Validates API key from Authorization header
 * @param req - The incoming request
 * @returns boolean indicating if the API key is valid
 */
export function validateApiKey(req: Request): boolean {
  // In a production environment, you would check against a database or environment variable
  // For now, we'll use a simple check against the environment variable
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  
  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
  const validApiKey = process.env.API_KEY;
  
  // If no API key is configured, allow all requests (development mode)
  if (!validApiKey) {
    console.warn("No API_KEY configured in environment variables. Authentication is disabled.");
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