-- Public student registration: verified-signup attempts + institution field.
-- Forward-only, generated from prisma/schema.prisma. No data is rewritten.

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "institution" TEXT;

-- CreateTable
CREATE TABLE "RegistrationAttempt" (
    "id" TEXT NOT NULL,
    "activeEmail" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "enrollmentNo" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "institution" TEXT,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "maxVerifyAttempts" INTEGER NOT NULL DEFAULT 5,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "completionTokenHash" TEXT,
    "completionExpiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationAttempt_pkey" PRIMARY KEY ("id")
);

-- Exactly one in-flight attempt per normalised email. Consumed attempts hold
-- NULL here, so PostgreSQL permits unlimited completed history.
CREATE UNIQUE INDEX "RegistrationAttempt_activeEmail_key" ON "RegistrationAttempt"("activeEmail");

-- CreateIndex
CREATE INDEX "RegistrationAttempt_email_idx" ON "RegistrationAttempt"("email");

-- CreateIndex
CREATE INDEX "RegistrationAttempt_consumedAt_idx" ON "RegistrationAttempt"("consumedAt");
