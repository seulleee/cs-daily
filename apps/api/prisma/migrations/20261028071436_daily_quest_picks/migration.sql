-- CreateTable
CREATE TABLE "daily_quest_picks" (
    "user_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "keys" VARCHAR(20)[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_quest_picks_pkey" PRIMARY KEY ("user_id","period")
);

-- AddForeignKey
ALTER TABLE "daily_quest_picks" ADD CONSTRAINT "daily_quest_picks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
