-- CreateEnum
CREATE TYPE "CodingLanguage" AS ENUM ('python', 'java', 'javascript', 'cpp');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "code_language" "CodingLanguage" NOT NULL DEFAULT 'python';
