import "dotenv/config";
import { createApp } from "./app.js";
import prisma from "./lib/prisma.js";

const port = Number(process.env.PORT ?? 4000);
// Localhost-only demo: never bind all interfaces. No tunnel, no public exposure.
const host = process.env.HOST ?? "127.0.0.1";
const app = createApp();

const server = app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://${host}:${port}`);
});

// Graceful shutdown: stop accepting connections, then release the DB pool.
function shutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`[api] received ${signal}, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
