-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "intro" TEXT[] DEFAULT ARRAY[]::TEXT[];
