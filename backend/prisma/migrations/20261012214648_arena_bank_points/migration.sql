-- CreateEnum
CREATE TYPE "ArenaPromptCategory" AS ENUM ('Behavioral', 'Technical', 'Situational');

-- CreateTable
CREATE TABLE "ArenaPrompt" (
    "id" TEXT NOT NULL,
    "category" "ArenaPromptCategory" NOT NULL,
    "prompt" TEXT NOT NULL,
    "hint" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaPointLedger" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaPointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaPrompt_isActive_idx" ON "ArenaPrompt"("isActive");

-- CreateIndex
CREATE INDEX "ArenaPrompt_authorId_idx" ON "ArenaPrompt"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaPointLedger_sessionId_key" ON "ArenaPointLedger"("sessionId");

-- CreateIndex
CREATE INDEX "ArenaPointLedger_studentProfileId_idx" ON "ArenaPointLedger"("studentProfileId");

-- AddForeignKey
ALTER TABLE "ArenaPrompt" ADD CONSTRAINT "ArenaPrompt_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaPointLedger" ADD CONSTRAINT "ArenaPointLedger_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaPointLedger" ADD CONSTRAINT "ArenaPointLedger_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
