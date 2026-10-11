import "dotenv/config";
import prisma from "./lib/prisma.js";

async function main(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  // eslint-disable-next-line no-console
  console.log("DB connection: OK");
}

main()
  .catch(() => {
    // eslint-disable-next-line no-console
    console.error("DB connection: FAILED (check backend/.env DATABASE_URL)");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
