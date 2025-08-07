import { serve } from "bun";
import { uploadHandler } from "./routes/upload";
import { extractHandler } from "./routes/extract";
import { summarizeHandler } from "./routes/summarize";
import resetRoute from "./routes/reset";
import { readFileSync } from 'fs';
import { join } from 'path';

const projectHtml = readFileSync(join(__dirname, 'project.html'), 'utf-8');

const addCors = (response: Response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
};

const server = serve({
  fetch: async (req) => {
    const url = new URL(req.url);

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return addCors(new Response(null, { status: 204 }));
    }

    // Serve project.html for root path
    if (url.pathname === "/") {
      return addCors(new Response(projectHtml, {
        headers: {
          "Content-Type": "text/html",
        },
      }));
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

    return addCors(response);
  },
  port: 5001,
});

console.log(`Server running at http://localhost:${server.port}`);
