-- AlterTable
ALTER TABLE "AssessmentAttempt" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "repoUrl" TEXT;

-- AlterTable
ALTER TABLE "JobOpportunity" ADD COLUMN     "niceToHave" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requiredSkills" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "salary" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
