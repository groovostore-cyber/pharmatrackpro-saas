require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const path = require("path");

const connectDB = require("./config/db");
const authMiddleware = require("./middleware/authMiddleware");
const { limiter, authLimiter } = require("./middleware/rateLimiter");
const requestLogger = require("./middleware/requestLogger");
const { sanitizeInput, validateJsonPayload } = require("./middleware/inputValidator");
const checkSubscription = require("./middleware/subscriptionCheck");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const logger = require("./utils/logger");

const authRoutes = require("./routes/authRoutes");
const statusRoutes = require("./routes/statusRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const customerRoutes = require("./routes/customerRoutes");
const saleRoutes = require("./routes/saleRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const creditRoutes = require("./routes/creditRoutes");
const exportRoutes = require("./routes/exportRoutes");

const app = express();
const http = require("http");
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()) || ["*"];

// ============================================
// PHASE 1: SECURITY & PRODUCTION HARDENING
// ============================================

// Connect to MongoDB
connectDB();

// Trust proxy when running behind a reverse proxy (useful in production)
app.set("trust proxy", 1);

// Security headers with Helmet
app.use(helmet());

// Compression for responses
app.use(compression());

// CORS configuration for production
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Body parsing with size limits (prevents large payload attacks)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================
// PHASE 2: REQUEST PROCESSING
// ============================================

// Request logging (before other middleware to log all requests)
app.use(requestLogger);

// Input validation and sanitization
app.use(sanitizeInput);
app.use(validateJsonPayload);

// Rate limiting (general)
app.use(limiter);

// ============================================
// PHASE 3: API ROUTES
// ============================================

// Health/Status checks (no auth required, before rate limits)
app.use("/api/status", statusRoutes);


// Auth routes (public)
// Mount auth routes at /api/auth so controllers define paths relative to this prefix
app.use("/api/auth", authRoutes);

// Export routes (public routes before auth check)
app.use("/api/export", exportRoutes);

// Subscription management routes (authenticated) - allow activation/status before global subscription enforcement
// Apply authentication only to subscription management endpoints
app.use("/api/subscription", authMiddleware, subscriptionRoutes);

// Protected routes - apply auth + subscription check per-route (keeps public routes public)
app.use("/api/medicines", authMiddleware, checkSubscription, medicineRoutes);
app.use("/api/customers", authMiddleware, checkSubscription, customerRoutes);
app.use("/api/sales", authMiddleware, checkSubscription, saleRoutes);
app.use("/api/settings", authMiddleware, checkSubscription, settingsRoutes);
app.use("/api/dashboard", authMiddleware, checkSubscription, dashboardRoutes);
app.use("/api/credits", authMiddleware, checkSubscription, creditRoutes);

// ============================================
// PHASE 4: STATIC FILE SERVING
// ============================================

// Serve HTML pages from ui/pages as root
// This allows /login.html, /signup.html, /dashboard.html, etc.
app.use(express.static(path.join(__dirname, "..", "ui", "pages"), {
  maxAge: "1d",
  etag: false,
  setHeaders: (res, path) => {
    // Don't cache HTML files (they may change)
    if (path.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  },
}));

// Serve assets folder
app.use("/assets", express.static(path.join(__dirname, "..", "assets"), {
  maxAge: "1d",
  etag: false,
}));

// Root route → login page
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "ui", "pages", "login.html"));
});

// ============================================
// PHASE 5: ERROR HANDLING
// ============================================

// 404 handler for all other requests
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handling middleware (MUST be last)
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  // Log error
  if (status >= 500) {
    logger.error("Server error", err);
  } else {
    logger.warn("Client error", { status, message });
  }

  // Prevent sensitive data leakage in production
  const response = {
    success: false,
    message: status >= 500 && NODE_ENV === "production" ? "Internal server error" : message,
  };

  if (NODE_ENV === "development" && status >= 500) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
});

// ============================================
// PHASE 6: SERVER STARTUP & ROBUST ERROR HANDLING
// ============================================

const server = http.createServer(app);

// ============================================
// SMART PORT MANAGEMENT SYSTEM
// ============================================
// Automatically finds available port if default is in use
// Retries up to 10 times (5000-5009)

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;
let CURRENT_PORT = DEFAULT_PORT;
const MAX_PORT_RETRIES = 10;
let portRetryCount = 0;

function onListening() {
  logger.info(`Server running on http://localhost:${CURRENT_PORT}`, {
    environment: NODE_ENV,
    port: CURRENT_PORT,
  });
}

function onError(err) {
  // Handle port already in use - try next port
  if (err && err.code === "EADDRINUSE") {
    portRetryCount++;

    if (portRetryCount < MAX_PORT_RETRIES) {
      CURRENT_PORT++;
      logger.warn(`Port ${CURRENT_PORT - 1} in use. Trying port ${CURRENT_PORT}...`, {
        attempt: portRetryCount,
        maxRetries: MAX_PORT_RETRIES,
      });

      // Remove error listeners to avoid stacking
      server.removeAllListeners("error");
      server.on("error", onError);

      // Retry with next port
      try {
        server.listen(CURRENT_PORT);
      } catch (retryErr) {
        logger.error("Socket error during port retry", { message: retryErr && retryErr.message });
        onError(retryErr);
      }
    } else {
      logger.error(
        `Failed to find available port after ${MAX_PORT_RETRIES} attempts (ports ${DEFAULT_PORT}-${CURRENT_PORT}). Exiting.`,
        { code: err.code }
      );
      setTimeout(() => process.exit(1), 100);
    }
    return;
  }

  // For other errors, log and exit with stack in development
  logger.error("Server error during startup", NODE_ENV === "development" ? err : { message: err && err.message });
  setTimeout(() => process.exit(1), 100);
}

// Start listening with robust handlers
server.on("error", onError);
server.on("listening", onListening);

try {
  server.listen(CURRENT_PORT);
} catch (err) {
  // Defensive: unexpected synchronous errors
  onError(err);
}

// ============================================
// PHASE 7: GRACEFUL SHUTDOWN
// ============================================

const shutdownGracefully = (signal, err) => {
  return async () => {
    logger.info(`${signal} received on port ${CURRENT_PORT}, shutting down gracefully...`);

    if (err) {
      logger.error("Shutdown triggered by error", NODE_ENV === "development" ? err : { message: err && err.message });
    }

    // Stop accepting new connections
    try {
      if (server && server.listening) {
        server.close(() => {
          logger.info("HTTP server closed");
        });
      }
    } catch (closeErr) {
      logger.warn("Error closing HTTP server", { message: closeErr && closeErr.message });
    }

    // Close MongoDB connection if open
    try {
      const mongoose = require("mongoose");
      if (mongoose && mongoose.connection && mongoose.connection.readyState) {
        await mongoose.connection.close(false);
        logger.info("MongoDB connection closed");
      }
    } catch (dbErr) {
      logger.warn("Error closing MongoDB connection", { message: dbErr && dbErr.message });
    }

    // Give background ops a small window to finish then exit
    setTimeout(() => process.exit(err ? 1 : 0), 500);
  };
};

// SIGTERM & SIGINT
process.on("SIGTERM", shutdownGracefully("SIGTERM"));
process.on("SIGINT", shutdownGracefully("SIGINT"));

// Handle uncaught exceptions and unhandled rejections by attempting graceful shutdown
process.on("uncaughtException", (err) => {
  // Log succinctly and attempt graceful shutdown
  logger.error("Uncaught exception, attempting graceful shutdown", NODE_ENV === "development" ? err : { message: err && err.message });
  const handler = shutdownGracefully("uncaughtException", err);
  handler();
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection, attempting graceful shutdown", NODE_ENV === "development" ? reason : { message: reason && reason.message });
  const handler = shutdownGracefully("unhandledRejection", reason);
  handler();
});
