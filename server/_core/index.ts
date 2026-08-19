import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerUploadRoutes } from "../upload";
import { registerPdfRoutes } from "../pdf";
import { registerApiDocs } from "../api-docs";
import { weeklyReminderHandler } from "../scheduled-reminders";
import { registerAutodeskRoutes } from "../autodesk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── ACC Iframe Support: Allow embedding in Autodesk Construction Cloud ───
  app.use((req, res, next) => {
    // Allow iframe embedding from Autodesk domains
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.removeHeader("X-Frame-Options");
    // Content-Security-Policy: allow framing from Autodesk
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors 'self' https://*.autodesk.com https://*.autodesk.io https://acc.autodesk.com https://construction.autodesk.com"
    );
    // Required for cookies in cross-origin iframes
    if (req.headers.origin && (req.headers.origin.includes("autodesk.com") || req.headers.origin.includes("autodesk.io"))) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    next();
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerUploadRoutes(app);
  registerPdfRoutes(app);
  registerApiDocs(app);
  registerAutodeskRoutes(app);
  // Scheduled endpoints (Heartbeat cron callbacks)
  app.post("/api/scheduled/weekly-reminder", weeklyReminderHandler);
  // Direct logout route (GET) - clears session and redirects to login
  app.get("/api/auth/logout", (req, res) => {
    res.clearCookie("app_session_id", { path: "/" });
    res.redirect("/login");
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
