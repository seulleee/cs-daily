-- CreateEnum
CREATE TYPE "PremiumPriceBand" AS ENUM ('free_only', 'lte_3000', 'from_3000_to_6000', 'from_6000_to_10000', 'gt_10000');

-- CreateTable
CREATE TABLE "premium_interests" (
    "user_id" UUID NOT NULL,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_band" "PremiumPriceBand" NOT NULL,
    "notify_consent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premium_interests_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "premium_interests" ADD CONSTRAINT "premium_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
