import type { Request, Response } from "express";
import { z } from "zod";

export const LEVEL = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]);

export function parsePaging(req: Request): { page: number; limit: number } {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
  return { page, limit };
}

export function zodDetails(err: z.ZodError): { path: string; message: string }[] {
  return err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

export function sendInvalid(res: Response, err: z.ZodError): void {
  res.status(400).json({ ok: false, error: "Invalid request", details: zodDetails(err) });
}
