# PugHub

Community scrim lobby with Steam auth, map veto, and team management, built on Next.js 16.

## Features
- Steam sign-in with lobby auto-join
- Team assignment and captain auto-selection
- Map pool selection (creator-only)
- ABBA-style map veto with timers and final map highlight
- SSE lobby updates
- Docker/compose setup for production + Postgres

## Requirements
- Node 20+
- Postgres (local or the compose service)
- Steam API key

## Quick start (local dev)
```bash
cp .env.example .env   # fill secrets, especially SESSION_SECRET and STEAM_API_KEY
npm install
npx prisma migrate dev # create schema
npm run dev
```
App runs on http://localhost:3000.

## Docker / compose
```bash
cp .env.example .env   # set secrets before building
docker compose up --build
```
The compose stack exposes:
- app: http://localhost:3000
- postgres: localhost:5432 (defaults match .env.example)

## Environment variables
See `.env.example` for all required values:
- `DATABASE_URL` – Postgres connection string
- `STEAM_REALM`, `STEAM_RETURN_URL` – URLs used for Steam OpenID
- `STEAM_API_KEY` – your Steam Web API key
- `SESSION_SECRET` – long random string for session signing

## Notes
- Set `SCRIM_START_STEAM_IDS` in production to restrict who can start scrims / manage servers.
- Never commit `.env` to git. Rotate `SESSION_SECRET`, `STEAM_API_KEY`, and any RCON/DB passwords if they leak.

## Development scripts
- `npm run dev` — start Next dev server
- `npm run build` — production build
- `npm start` — start built app
- `npm run lint` — lint

## License
MIT. See `LICENSE`.
