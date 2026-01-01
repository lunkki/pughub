-- CreateTable
CREATE TABLE "SteamProfile" (
    "steamId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamProfile_pkey" PRIMARY KEY ("steamId")
);
