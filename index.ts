import { serve } from "bun";
import { uploadHandler } from "./routes/upload";
import { extractHandler } from "./routes/extract";
import { summarizeHandler } from "./routes/summarize";
import resetRoute from "./routes/reset";
import { readFileSync } from 'fs';
import { join } from 'path';

const projectHtml = readFileSync(join(__dirname, 'project.html'), 'utf-8');

const server = serve({
  fetch: async (req) => {
    const url = new URL(req.url);

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Serve project.html for root path
    if (url.pathname === "/") {
      return new Response(projectHtml, {
        headers: {
          "Content-Type": "text/html",
        },
      });
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
    } else {
      response = new Response("Not Found", { status: 404 });
    }

    // Add CORS headers to all responses
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  },
  port: 5001,
});

console.log(`Server running at http://localhost:${server.port}`);
