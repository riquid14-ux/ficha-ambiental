import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import { deadlineReminderHandler } from "../scheduled-reminders";
import { registerAutodeskRoutes } from "../autodesk";
import { registerHealthRoutes } from "../health";
import { registerDocumentLibraryRoutes } from "../document-library";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

function isAllowedAutodeskOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return ["autodesk.com", "autodesk.io"].some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
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
  const cspScriptSources = process.env.NODE_ENV === "production" ? ["'self'"] : ["'self'", "'unsafe-inline'"];
  // A aplicação corre atrás de um único reverse proxy (Nginx/hosting gerido).
  // Permite ao rate limiter usar com segurança o endereço real do cliente.
  app.set("trust proxy", 1);
  const server = createServer(app);

  // ─── Security Headers ───────────────────────────────────────────────────
  app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: cspScriptSources,
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://api.manus.im"],
        frameSrc: ["'self'", "https://www.youtube.com"],
        frameAncestors: ["'self'", "https://*.autodesk.com", "https://*.autodesk.io", "https://acc.autodesk.com", "https://construction.autodesk.com"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for ACC iframe
    frameguard: false, // frame-ancestors CSP limita o embedding a ACC
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }, // Required for YouTube embeds (no-referrer blocks them)
  }));

  // ─── Rate Limiting on Auth Endpoints ────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 attempts per 15 min per IP
    message: { error: "Demasiadas tentativas. Tente novamente em 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const documentReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { error: "Demasiadas consultas a documentos. Tente novamente mais tarde." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const documentWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Demasiadas operações de documentação. Tente novamente mais tarde." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Apply rate limiting to auth-related tRPC mutations
  app.use("/api/trpc/auth.login", authLimiter);
  app.use("/api/trpc/auth.register", authLimiter);
  app.use("/api/trpc/auth.verify2FA", authLimiter);
  app.use("/api/trpc/auth.forgotPassword", authLimiter);
  app.use("/api/trpc/auth.resetPasswordWithToken", authLimiter);
  app.use("/api/trpc/documentLibrary.create", documentWriteLimiter);
  app.use("/api/trpc/documentLibrary.update", documentWriteLimiter);
  app.use("/api/trpc/documentLibrary.delete", documentWriteLimiter);
  app.use("/api/documentos", documentReadLimiter);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── ACC Iframe Support: Allow embedding in Autodesk Construction Cloud ───
  app.use((req, res, next) => {
    // Required for cookies in cross-origin iframes
    if (req.headers.origin && isAllowedAutodeskOrigin(req.headers.origin)) {
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
  registerHealthRoutes(app);
  registerDocumentLibraryRoutes(app);
  // Scheduled endpoints (Heartbeat cron callbacks)
  app.post("/api/scheduled/weekly-reminder", weeklyReminderHandler);
  app.post("/api/scheduled/deadline-reminder", deadlineReminderHandler);
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
