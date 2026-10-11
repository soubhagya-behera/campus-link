import type { NextFunction, Request, Response } from "express";

/** 404 handler for unknown routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ ok: false, error: "Not found" });
}

/**
 * Central error handler. Logs the full error server-side but never
 * leaks secrets or raw database errors to API clients.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // eslint-disable-next-line no-console
  console.error("[api] error:", err instanceof Error ? err.message : err);
  res.status(500).json({ ok: false, error: "Internal server error" });
}
