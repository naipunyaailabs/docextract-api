import { serve } from "bun";
import { uploadHandler } from "./routes/upload";
import { extractHandler } from "./routes/extract";
import { summarizeHandler } from "./routes/summarize";
import { readFileSync } from 'fs';
import { join } from 'path';
import { authenticateRequest } from "./utils/auth";
import { PORT, logConfig, validateConfig, ALLOWED_ORIGINS } from "./utils/config";
import { summarizeRfpHandler } from "./routes/summarizeRfp";
import { createRfpHandler } from "./routes/createRfp";
import { authHandler } from "./routes/auth";
import { servicesHandler } from "./routes/services";
import { processDocumentHandler } from "./routes/processDocument";
import { aguiProcessHandler } from "./routes/agui";
import DatabaseService from "./services/database";

// Validate configuration on startup
try {
  validateConfig();
  logConfig();
} catch (error) {
  console.error("Configuration error:", (error as Error).message);
  process.exit(1);
}

// Initialize database connection
DatabaseService.connect().catch(err => {
  console.error("Failed to connect to database:", err);
  process.exit(1);
});

const projectHtml = readFileSync(join(__dirname, 'project.html'), 'utf-8');

const addCors = (req: Request, response: Response) => {
  const origin = req.headers.get("Origin");
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  } else if (!origin) {
    // For non-browser requests (like curl) or if origin is missing, 
    // we might want to allow it or strict block. 
    // For now, let's allow it but not set A-C-A-O to avoid browser issues.
    // Or set to * if we want to allow everything (NOT RECOMMENDED for production)
  }

  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours
  return response;
};

const server = serve({
  fetch: async (req) => {
    const url = new URL(req.url);

    // Handle CORS preflight requests for all routes
    if (req.method === "OPTIONS") {
      return addCors(req, new Response(null, { status: 204 }));
    }

    // Serve project.html for root path (no authentication required)
    if (url.pathname === "/") {
      return addCors(req, new Response(projectHtml, {
        headers: {
          "Content-Type": "text/html",
        },
      }));
    }

    // Handle authentication routes (no authentication required)
    if (url.pathname.startsWith("/auth/")) {
      const response = await authHandler(req);
      return addCors(req, response);
    }

    // Handle services routes
    if (url.pathname.startsWith("/services")) {
      const response = await servicesHandler(req);
      return addCors(req, response);
    }

    // Handle document processing routes
    if (url.pathname.startsWith("/process/")) {
      const response = await processDocumentHandler(req);
      return addCors(req, response);
    }

    // Handle AG-UI routes
    if (url.pathname.startsWith("/agui/")) {
      const response = await aguiProcessHandler(req);
      return addCors(req, response);
    }

    let response: Response;
    try {
      if (req.method === "POST" && url.pathname === "/upload") {
        response = await uploadHandler(req);
      } else if (req.method === "POST" && url.pathname === "/extract") {
        response = await extractHandler(req);
      } else if (req.method === "POST" && url.pathname === "/summarize") {
        response = await summarizeHandler(req);
      } else if (req.method === "POST" && url.pathname === "/summarize-rfp") {
        response = await summarizeRfpHandler(req);
      } else if (req.method === "POST" && url.pathname === "/create-rfp") {
        response = await createRfpHandler(req);
      } else {
        response = new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("[Server Error]:", error);
      response = new Response(JSON.stringify({ error: "Internal server error" }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }

    return addCors(req, response);
  },
  port: PORT,
});

console.log(`Server running at http://localhost:${server.port}`);
console.log(`API Key (for development): ${process.env.API_KEY || 'Not set'}`);