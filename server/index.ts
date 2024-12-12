import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files with proper MIME types
const staticOptions = {
  setHeaders: (res: Response, path: string) => {
    if (path.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
    }
  }
};

// Serve static files from various directories
app.use('/thumbnails', express.static('public/thumbnails', staticOptions));
app.use('/combinations', express.static('public/combinations', staticOptions));
app.use('/uploads', express.static('uploads', staticOptions));

// Log static file access
app.use((req, res, next) => {
  if (req.path.match(/\.(mp4|jpg|jpeg|png)$/)) {
    console.log(`[Static] Serving: ${req.path}`);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const PORT = 5000;
  let serverInstance = server;
  
  // Cleanup function to ensure proper shutdown
  const cleanup = () => {
    log('Shutting down server...');
    if (serverInstance) {
      serverInstance.close(() => {
        log('Server closed');
        process.exit(0);
      });

      // Force close after 3 seconds if graceful shutdown fails
      setTimeout(() => {
        log('Force closing server...');
        process.exit(1);
      }, 3000);
    } else {
      process.exit(0);
    }
  };

  // Register cleanup handlers
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
  });

  // Start the server
  serverInstance.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  }).on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
      cleanup();
    } else {
      console.error('Server error:', error);
      cleanup();
    }
  });
})();
