-- CreateTable
CREATE TABLE "friend_quests" (
    "id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "goal" SMALLINT NOT NULL DEFAULT 15,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "friend_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_quest_members" (
    "quest_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,

    CONSTRAINT "friend_quest_members_pkey" PRIMARY KEY ("quest_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friend_quest_members_week_start_user_id_key" ON "friend_quest_members"("week_start", "user_id");

-- AddForeignKey
ALTER TABLE "friend_quest_members" ADD CONSTRAINT "friend_quest_members_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "friend_quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_quest_members" ADD CONSTRAINT "friend_quest_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
