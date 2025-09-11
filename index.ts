import { serve } from "bun";
import { uploadHandler } from "./routes/upload";
import { extractHandler } from "./routes/extract";
import { summarizeHandler } from "./routes/summarize";
import resetRoute from "./routes/reset";
import { readFileSync } from 'fs';
import { join } from 'path';
import { authenticateRequest } from "./utils/auth";
import { PORT, logConfig, validateConfig } from "./utils/config";
import { summarizeRfpHandler } from "./routes/summarizeRfp";

// Validate configuration on startup
try {
  validateConfig();
  logConfig();
} catch (error) {
  console.error("Configuration error:", (error as Error).message);
  process.exit(1);
}

const projectHtml = readFileSync(join(__dirname, 'project.html'), 'utf-8');

const addCors = (response: Response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
};

const server = serve({
  fetch: async (req) => {
    const url = new URL(req.url);

    // Handle CORS preflight requests
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

    // Apply authentication to all API routes except the ones we want to keep public
    const protectedRoutes = ["/upload", "/extract", "/summarize", "/reset"];
    if (protectedRoutes.includes(url.pathname) && req.method === "POST") {
      const authResponse = authenticateRequest(req);
      if (authResponse) {
        return addCors(authResponse);
      }
    }

    let response: Response;
    if (req.method === "POST" && url.pathname === "/upload") {
      response = await uploadHandler(req);
    } else if (req.method === "POST" && url.pathname === "/extract") {
      response = await extractHandler(req);
    } else if (req.method === "POST" && url.pathname === "/summarize") {
      response = await summarizeHandler(req);
    } else if (url.pathname === "/reset" && req.method === "POST") {
      response = await resetRoute(req);
    } else if (req.method === "POST" && url.pathname === "/summarize-rfp") {
      response = await summarizeRfpHandler(req);
    } else {
      response = new Response("Not Found", { status: 404 });
    }


    return addCors(response);
  },
  port: PORT,
});

console.log(`Server running at http://localhost:${server.port}`);
console.log(`API Key (for development): ${process.env.API_KEY || 'Not set'}`);