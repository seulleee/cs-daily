-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "key_points" TEXT[] DEFAULT ARRAY[]::TEXT[];
