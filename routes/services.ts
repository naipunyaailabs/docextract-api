import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler";
import serviceService from "../services/serviceService";
import { validateApiKey } from "../utils/auth";

export async function servicesHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(p => p);
  // /services or /services/:id
  const serviceId = pathParts.length > 1 ? pathParts[1] : null;

  console.log(`[ServicesHandler] Request received for path: ${url.pathname}`);
  console.log(`[ServicesHandler] Method: ${req.method}`);
  console.log(`[ServicesHandler] ServiceId: ${serviceId}`);

  try {
    // Allow GET requests without authentication
    if (req.method.toUpperCase() === "GET") {
      console.log("[ServicesHandler] Processing public GET request");
      if (!serviceId) {
        // GET /services - List all services
        return await listServicesHandler(req);
      } else {
        // GET /services/{serviceId} - Get specific service
        return await getServiceHandler(req, serviceId);
      }
    }

    console.log("[ServicesHandler] Non-GET request, checking authentication...");
    // Apply authentication to non-GET routes
    if (!(await validateApiKey(req))) {
      console.log("[ServicesHandler] Authentication failed, returning 401");
      return createErrorResponse("Unauthorized", 401);
    }

    return createErrorResponse("Method not allowed", 405);
  } catch (error) {
    console.error("[Services Handler Error]:", error);
    return createErrorResponse("Internal server error", 500);
  }
}

async function listServicesHandler(req: Request): Promise<Response> {
  try {
    const services = await serviceService.findAllServices();
    console.log(`[ServicesHandler] findAllServices returned ${services?.length || 0} services`);
    if (!services) {
      return createErrorResponse("Failed to retrieve services", 500);
    }
    
    return createSuccessResponse(services);
  } catch (error) {
    console.error("[List Services Handler Error]:", error);
    return createErrorResponse("Failed to retrieve services", 500);
  }
}

async function getServiceHandler(req: Request, serviceId: string): Promise<Response> {
  try {
    // Try to find by ID first, then by slug
    let service = await serviceService.findServiceById(serviceId);
    if (!service) {
      service = await serviceService.findServiceBySlug(serviceId);
    }
    
    if (!service) {
      return createErrorResponse("Service not found", 404);
    }
    
    return createSuccessResponse(service);
  } catch (error) {
    console.error("[Get Service Handler Error]:", error);
    return createErrorResponse("Failed to retrieve service", 500);
  }
}