-- CreateEnum
CREATE TYPE "VetoOption" AS ENUM ('ACTIVE_DUTY', 'ALL_MAPS', 'RANDOM', 'PRESELECT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ScrimStatus" AS ENUM ('LOBBY', 'STARTING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeamMode" AS ENUM ('SHUFFLE', 'CAPTAINS');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('TEAM1', 'TEAM2', 'WAITING_ROOM');

-- CreateEnum
CREATE TYPE "VetoMode" AS ENUM ('CAPTAINS', 'PLAYERS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "rconPassword" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scrim" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "status" "ScrimStatus" NOT NULL DEFAULT 'LOBBY',
    "teamMode" "TeamMode" NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 10,
    "mapPool" TEXT,
    "matchzyMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "vetoOption" "VetoOption" NOT NULL DEFAULT 'ACTIVE_DUTY',
    "selectedMap" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vetoMode" "VetoMode" NOT NULL DEFAULT 'CAPTAINS',
    "vetoState" TEXT,

    CONSTRAINT "Scrim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrimPlayer" (
    "id" TEXT NOT NULL,
    "scrimId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "team" "Team" NOT NULL DEFAULT 'WAITING_ROOM',
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrimPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "Scrim_code_key" ON "Scrim"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ScrimPlayer_scrimId_userId_key" ON "ScrimPlayer"("scrimId", "userId");

-- AddForeignKey
ALTER TABLE "Scrim" ADD CONSTRAINT "Scrim_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrim" ADD CONSTRAINT "Scrim_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimPlayer" ADD CONSTRAINT "ScrimPlayer_scrimId_fkey" FOREIGN KEY ("scrimId") REFERENCES "Scrim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimPlayer" ADD CONSTRAINT "ScrimPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
