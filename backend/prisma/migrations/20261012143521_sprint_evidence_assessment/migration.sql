-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "assessmentId" TEXT;

-- CreateIndex
CREATE INDEX "Project_studentProfileId_assessmentId_idx" ON "Project"("studentProfileId", "assessmentId");
