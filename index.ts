import { serve } from "bun";
import { uploadHandler } from "./routes/upload";
import { extractHandler } from "./routes/extract";
import { summarizeHandler } from "./routes/summarize";
import { readFileSync } from 'fs';
import { join } from 'path';
import { authenticateRequest } from "./utils/auth";
import { PORT, logConfig, validateConfig } from "./utils/config";
import { summarizeRfpHandler } from "./routes/summarizeRfp";
import { createRfpHandler } from "./routes/createRfp";
import { authHandler } from "./routes/auth";
import { servicesHandler } from "./routes/services";
import { processDocumentHandler } from "./routes/processDocument";
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

const addCors = (response: Response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
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
      return addCors(new Response(null, { status: 204 }));
    }

    // Serve project.html for root path (no authentication required)
    if (url.pathname === "/") {
      return addCors(new Response(projectHtml, {
        headers: {
          "Content-Type": "text/html",
        },
      }));
    }

    // Handle authentication routes (no authentication required)
    if (url.pathname.startsWith("/auth/")) {
      const response = await authHandler(req);
      return addCors(response);
    }

    // Handle services routes
    if (url.pathname.startsWith("/services")) {
      const response = await servicesHandler(req);
      return addCors(response);
    }

    // Handle document processing routes
    if (url.pathname.startsWith("/process/")) {
      const response = await processDocumentHandler(req);
      return addCors(response);
    }

    // Apply authentication to all API routes except the ones we want to keep public
    const protectedRoutes = ["/upload", "/extract", "/summarize", "/reset", "/summarize-rfp", "/create-rfp"];
    if (protectedRoutes.includes(url.pathname) && req.method === "POST") {
      const authResponse = authenticateRequest(req);
      if (authResponse) {
        return addCors(authResponse);
      }
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

    return addCors(response);
  },
  port: PORT,
});

console.log(`Server running at http://localhost:${server.port}`);
console.log(`API Key (for development): ${process.env.API_KEY || 'Not set'}`);