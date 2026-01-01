-- Allow placeholder scrim players without linked users
ALTER TABLE "ScrimPlayer" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "ScrimPlayer" ALTER COLUMN "steamId" DROP NOT NULL;

ALTER TABLE "ScrimPlayer" ADD COLUMN "displayName" TEXT;
ALTER TABLE "ScrimPlayer" ADD COLUMN "isPlaceholder" BOOLEAN NOT NULL DEFAULT false;
