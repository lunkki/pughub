-- Add rconAddress to Server for separate RCON endpoint
ALTER TABLE "Server" ADD COLUMN "rconAddress" TEXT;
