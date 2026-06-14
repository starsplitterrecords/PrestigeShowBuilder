import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// Setup ES module filename and directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Starts the central full-stack Node.js/Express server.
 * Configures request body parsers, exposes configuration endpoints, provisions the Gemini API proxy
 * for secure server-side model interaction, and initializes development (Vite) or production static serving.
 * 
 * @returns {Promise<void>} Resolves when the server is listening
 */
async function startServer() {
  const app = express();
  const PORT = 3000;

  /**
   * Serializes arbitrary values to JSON strings while gracefully handling and annotating
   * circular references to prevent runtime serialization crashes.
   * 
   * @param {any} obj - The target object or value to safely stringify
   * @returns {string} The safe JSON string representation
   */
  function safeStringify(obj: any): string {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return `[Circular ${key}]`;
        cache.add(value);
      }
      return value;
    });
  }

  // Middleware for parsing large incoming request bodies (up to 10MB JSON and URL-encoded)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  /**
   * GET /api/config
   * 
   * Simple API route to safely check environment key presence.
   * Exposes the status of required environment keys without leaking secrets in logs or responses.
   */
  app.get("/api/config", (req, res) => {
    res.json({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
      API_KEY: process.env.API_KEY || "",
    });
  });

  /**
   * ALL /gemini-api-proxy/*all
   * 
   * Server-Side Gemini API Proxy.
   * Intercepts requests destined for Google's Generative Language API. 
   * Injects the server-side `API_KEY` or `GEMINI_API_KEY` to guarantee that keys are never exposed on client-side,
   * bypasses browser CORS issues, parses necessary control headers, and replies with structured responses.
   * 
   * Major capability: MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API
   */
  app.all("/gemini-api-proxy/*all", async (req, res) => {
    const apiPath = req.params.all || req.path.replace("/gemini-api-proxy/", "");
    const query = { ...req.query };
    
    // Remove the custom proxy flag from the upstream query object
    delete query.__applet_proxy;
    
    // Prioritize server-side key in Cloud Run environment to ensure reliability.
    // API_KEY is the security key injected after model/user authorization in AI Studio settings.
    const serverKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    console.log(`[Proxy] Request to ${apiPath}. Server key present: ${!!serverKey}`);
    
    if (serverKey) {
      query.key = serverKey;
    } else if (!query.key && !req.headers["x-goog-api-key"]) {
      console.error("[Proxy] No API key found in environment variables or request!");
      return res.status(401).json({ 
        error: "API Key missing",
        message: "Please set API_KEY or GEMINI_API_KEY in your Cloud Run environment variables, or provide a key in the request."
      });
    }

    const queryString = new URLSearchParams(query as any).toString();
    const url = `https://generativelanguage.googleapis.com/${apiPath}${queryString ? '?' + queryString : ''}`;
    
    console.log(`[Proxy] Forwarding ${req.method} to: ${url.replace(/key=[^&]+/, 'key=REDACTED')}`);

    try {
      const fetchOptions: any = {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-client": (req.headers["x-goog-api-client"] as string) || "genai-js",
          "x-goog-api-key": serverKey || (req.headers["x-goog-api-key"] as string) || (query.key as string) || "",
        },
      };

      // Set of trusted Google request headers to cleanly forward downstream
      const headersToForward = [
        "x-goog-user-project",
        "x-goog-api-client",
        "x-goog-request-params",
        "user-agent",
        "accept",
        "authorization"
      ];

      for (const header of headersToForward) {
        if (req.headers[header]) {
          fetchOptions.headers[header] = req.headers[header];
        }
      }

      // Append request body safely on mutation methods
      if (req.method !== "GET" && req.method !== "HEAD") {
        fetchOptions.body = safeStringify(req.body);
      }

      const response = await fetch(url, fetchOptions);
      console.log(`[Proxy] Upstream response status: ${response.status}`);
      
      // Selectively forward headers from upstream, skipping proxy/transport headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[Proxy] Upstream error ${response.status}:`, safeStringify(data));
      }

      res.status(response.status).set(responseHeaders).json(data);
    } catch (error: any) {
      console.error("[Proxy] Fatal error encountered during request proxying:", error);
      res.status(500).json({ 
        error: "Proxy failed", 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Conditionally mount Vite development assets middleware or bundle production static folders
  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Mount the Vite environment to enable source mapping and hot reloading on port 3000
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve prerendered static assets from /dist and direct catch-all routes to index.html for clients
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start Express listener on port 3000 for standard ingress routing
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Inception point
startServer();
