-- CreateEnum
CREATE TYPE "ChatLogType" AS ENUM ('text', 'image', 'video');

-- CreateEnum
CREATE TYPE "ChatLogSpeaker" AS ENUM ('user', 'ai');

-- CreateTable
CREATE TABLE "users" (
    "clerk_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("clerk_id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" SERIAL NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "image_url" VARCHAR(1024) NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "introduction" TEXT,
    "prompt" JSONB NOT NULL,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" SERIAL NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "character_id" INTEGER NOT NULL,
    "friendship" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "likes" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatLog" (
    "id" SERIAL NOT NULL,
    "chatroom_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" "ChatLogType" NOT NULL,
    "speaker" "ChatLogSpeaker" NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Persona_clerk_id_idx" ON "Persona"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_id_key" ON "ChatRoom"("id");

-- CreateIndex
CREATE INDEX "ChatLog_chatroom_id_idx" ON "ChatLog"("chatroom_id");

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_clerk_id_fkey" FOREIGN KEY ("clerk_id") REFERENCES "users"("clerk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_clerk_id_fkey" FOREIGN KEY ("clerk_id") REFERENCES "users"("clerk_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatLog" ADD CONSTRAINT "ChatLog_chatroom_id_fkey" FOREIGN KEY ("chatroom_id") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
