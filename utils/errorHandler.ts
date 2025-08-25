/**
 * Standardized error response format for API endpoints
 * @param message - Error message to return
 * @param status - HTTP status code (default: 500)
 * @param details - Additional error details (optional)
 * @returns Response object with standardized error format
 */
export function createErrorResponse(message: string, status: number = 500, details?: any): Response {
  const errorResponse = {
    error: message,
    status,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Standardized success response format for API endpoints
 * @param data - Data to return
 * @param status - HTTP status code (default: 200)
 * @returns Response object with standardized success format
 */
export function createSuccessResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}