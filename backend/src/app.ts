import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import applicationsRouter from "./routes/applications.js";
import assessmentsRouter from "./routes/assessments.js";
import attemptsRouter from "./routes/attempts.js";
import demoRouter from "./routes/demo.js";
import healthRouter from "./routes/health.js";
import opportunitiesRouter from "./routes/opportunities.js";
import studentsRouter from "./routes/students.js";
import towerRouter from "./routes/tower.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  app.use(limiter);

  app.use("/api", healthRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/opportunities", opportunitiesRouter);
  app.use("/api/applications", applicationsRouter);
  app.use("/api/assessments", assessmentsRouter);
  app.use("/api/attempts", attemptsRouter);
  app.use("/api/tower", towerRouter);
  app.use("/api/demo", demoRouter);

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
