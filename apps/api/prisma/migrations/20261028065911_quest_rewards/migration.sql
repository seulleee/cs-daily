-- CreateTable
CREATE TABLE "quest_rewards" (
    "user_id" UUID NOT NULL,
    "quest_key" VARCHAR(20) NOT NULL,
    "period" DATE NOT NULL,
    "xp" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quest_rewards_pkey" PRIMARY KEY ("user_id","quest_key","period")
);

-- AddForeignKey
ALTER TABLE "quest_rewards" ADD CONSTRAINT "quest_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
