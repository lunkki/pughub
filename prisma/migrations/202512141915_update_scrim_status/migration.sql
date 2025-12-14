-- Normalize scrim status enum to new values
-- Old enum: LOBBY, STARTING, IN_PROGRESS, FINISHED, CANCELLED
-- New enum: LOBBY, MAP_VETO, READY_TO_PLAY, FINISHED, CANCELLED

-- Clean up if a failed attempt left the temp enum around
DROP TYPE IF EXISTS "ScrimStatus_new";

-- 1) Create the new enum type
CREATE TYPE "ScrimStatus_new" AS ENUM ('LOBBY', 'MAP_VETO', 'READY_TO_PLAY', 'FINISHED', 'CANCELLED');

-- 2) Drop default to allow casting
ALTER TABLE "Scrim" ALTER COLUMN "status" DROP DEFAULT;

-- 3) Move data, remapping legacy values to new ones
ALTER TABLE "Scrim"
  ALTER COLUMN "status"
  TYPE "ScrimStatus_new"
  USING (
    CASE "status"
      WHEN 'STARTING' THEN 'MAP_VETO'::text
      WHEN 'IN_PROGRESS' THEN 'READY_TO_PLAY'::text
      ELSE "status"::text
    END
  )::"ScrimStatus_new";

-- 4) Restore default on the new enum
ALTER TABLE "Scrim" ALTER COLUMN "status" SET DEFAULT 'LOBBY';

-- 5) Drop the old enum and rename the new one into place
DROP TYPE "ScrimStatus";
ALTER TYPE "ScrimStatus_new" RENAME TO "ScrimStatus";
