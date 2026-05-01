-- CreateEnum
CREATE TYPE "ReadyCheckStatus" AS ENUM ('READY', 'NOT_READY');

-- AlterTable
ALTER TABLE "Scrim" ADD COLUMN "readyCheckStartedAt" TIMESTAMP(3);
ALTER TABLE "Scrim" ADD COLUMN "readyCheckEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ScrimPlayer" ADD COLUMN "readyCheckStatus" "ReadyCheckStatus";
