-- Add rconAddress to Server for separate RCON endpoint
-- Safe to re-run if column already exists
ALTER TABLE "Server" ADD COLUMN IF NOT EXISTS "rconAddress" TEXT;
