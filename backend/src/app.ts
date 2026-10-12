import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { csrfOriginCheck } from "./lib/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import applicationsRouter from "./routes/applications.js";
import arenaBankRouter from "./routes/arena-bank.js";
import announcementsRouter from "./routes/announcements.js";
import notificationsRouter from "./routes/notifications.js";
import arenaRouter from "./routes/arena.js";
import authRouter from "./routes/auth.js";
import assessmentsRouter from "./routes/assessments.js";
import attemptsRouter from "./routes/attempts.js";
import healthRouter from "./routes/health.js";import opportunitiesRouter from "./routes/opportunities.js";
import passportRouter from "./routes/passport.js";
import registerRouter from "./routes/register.js";
import studentsRouter from "./routes/students.js";
import towerRouter from "./routes/tower.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  // Localhost-only demo: only the local Vite frontend is a permitted browser
  // origin. Function form (not a fixed string) so non-matching origins get NO
  // ACAO header at all. No credentials, no wildcard. Override with CORS_ORIGIN
  // only for another explicit loopback URL.
  const frontendOrigin = process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173";
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin === frontendOrigin),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  // Malformed JSON must be a 400, not a 500: express.json raises
  // entity.parse.failed before any route runs.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed") {
        res.status(400).json({ ok: false, error: "Invalid JSON body" });
        return;
      }
      next(err as Error);
    },
  );
  // Reject cross-origin browser mutations that do not come from the frontend.
  app.use(csrfOriginCheck);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  app.use(limiter);

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  // Public, unauthenticated student registration (email-verified signup).
  app.use("/api/auth/register", registerRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/students", passportRouter);
  app.use("/api/opportunities", opportunitiesRouter);
  app.use("/api/applications", applicationsRouter);
  app.use("/api/announcements", announcementsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/arena", arenaRouter);
  app.use("/api/arena", arenaBankRouter);
  app.use("/api/assessments", assessmentsRouter);
  app.use("/api/attempts", attemptsRouter);
  app.use("/api/tower", towerRouter);

  // Example validated endpoint (no DB write; demonstrates request validation).
  const echoSchema = z.object({ message: z.string().min(1).max(280) });
  app.post("/api/echo", (req, res, next) => {
    try {
      const parsed = echoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid request body" });
      }
      return res.json({ ok: true, echo: parsed.data.message });
    } catch (err) {
      return next(err);
    }
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
