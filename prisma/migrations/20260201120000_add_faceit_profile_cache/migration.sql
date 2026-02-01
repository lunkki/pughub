-- CreateTable
CREATE TABLE "FaceitProfile" (
    "steamId" TEXT NOT NULL,
    "nickname" TEXT,
    "elo" INTEGER,
    "level" INTEGER,
    "faceitUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaceitProfile_pkey" PRIMARY KEY ("steamId")
);
