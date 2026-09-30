import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { bandsRouter } from "./bands.routes";
import { employeeRouter } from "./employee.routes";
import { AppError } from "./employee.service";
import { figuresRouter } from "./figures.routes";

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.issues },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }
  console.error(error);
  res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong", details: null },
  });
};

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", employeeRouter);
  app.use("/api", figuresRouter);
  app.use("/api", bandsRouter);
  app.use(handleError);
  return app;
}
