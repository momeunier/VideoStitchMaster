import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer, type Server } from "http";

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

// Request logging middleware
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

async function startServer(): Promise<Server> {
  let serverInstance = registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error('Error middleware:', err);
  });

  // Setup Vite or static serving
  if (app.get("env") === "development") {
    await setupVite(app, serverInstance);
  } else {
    serveStatic(app);
  }

  return new Promise((resolve, reject) => {
    const PORT = 5000;
    
    serverInstance.listen(PORT, "0.0.0.0", () => {
      log(`Server started successfully on port ${PORT}`);
      resolve(serverInstance);
    }).on('error', (error: any) => {
      console.error('Server startup error:', error);
      reject(error);
    });
  });
}

async function main() {
  let server: Server | null = null;
  let retries = 0;
  const MAX_RETRIES = 3;

  // Cleanup function
  const cleanup = async () => {
    if (server) {
      return new Promise<void>((resolve) => {
        console.log('Initiating server shutdown...');
        server!.close(() => {
          console.log('Server closed successfully');
          resolve();
        });

        // Force close after timeout
        setTimeout(() => {
          console.log('Force closing server after timeout');
          resolve();
        }, 3000);
      });
    }
  };

  // Register cleanup handlers
  const handleShutdown = async () => {
    console.log('Shutdown signal received');
    await cleanup();
    process.exit(0);
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
  process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    await cleanup();
    process.exit(1);
  });
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await cleanup();
    process.exit(1);
  });

  while (retries < MAX_RETRIES) {
    try {
      console.log(`Starting server (attempt ${retries + 1}/${MAX_RETRIES})...`);
      server = await startServer();
      break;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port 5000 is in use, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries++;
        if (retries === MAX_RETRIES) {
          console.error('Max retries reached, exiting...');
          process.exit(1);
        }
      } else {
        console.error('Fatal server error:', error);
        process.exit(1);
      }
    }
  }
}

main().catch(async (error) => {
  console.error('Fatal application error:', error);
  process.exit(1);
});
