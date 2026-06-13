# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A World Cup 2026 prediction pool app. Users join rooms, predict match outcomes (win/draw + exact score), earn points per stage, and compete on a leaderboard. Built for a friend group — Firebase Auth (Google + guest), PostgreSQL via Drizzle ORM, Express API on Vercel serverless, React + Vite + Tailwind frontend.

## Commands

```bash
npm run dev          # Vite dev server (frontend only, no API)
npm run build        # Production build → dist/
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run db:push      # Push schema changes to Postgres (drizzle-kit push)
npm run db:studio    # Open Drizzle Studio GUI
```

No test framework is configured. No linter beyond `tsc`.

## Architecture

**Two-tier monorepo deployed to Vercel:**

- `api/index.ts` — Express app exported as a single Vercel serverless function. All `/api/*` routes live here. Uses `@vercel/node` builder.
- `src/` — React SPA built by Vite, served as static files. Uses `@vercel/static-build` with `dist/` output.
- `vercel.json` rewrites `/api/*` → the serverless function, everything else → `index.html` (SPA fallback).

**Auth flow:** Firebase Auth on the client (`src/App.tsx`) → ID token sent as `Bearer` header → `src/middleware/auth.ts` verifies via `firebase-admin` → upserts user to Postgres via `src/db/users.ts` → attaches `req.dbUser` for all protected routes.

**Database:** PostgreSQL (Neon). Connection string from `DATABASE_URL` or `POSTGRES_URL` env var. Pool capped at 1 connection for serverless. Schema defined in `src/db/schema.ts`, connection in `src/db/index.ts`.

**Scoring engine (`src/lib/engine.ts`):** Server-side scoring. Points scale by tournament stage (30 for Group → 150 for Final, +5 bonus for exact score). Compliance system enforces a rolling pick window per stage (e.g., must pick at least 1 of every 3 Group Stage matches). Both `calculateScore()` and `isCompliant()` operate on DTO arrays, no DB dependency.

**Client-side rules mirror (`src/lib/rules.ts` + `src/lib/constants.ts`):** Duplicates compliance logic for UI warnings. Constants (stage points, cycle rules, lock offset) defined separately from the server engine — keep them in sync manually.

**Key tables:** `users`, `rooms`, `room_members`, `matches`, `picks`, `score_events`, `audit_logs`. See `src/db/schema.ts` for full schema with relations.

**Live match updates:** Webhook endpoint at `POST /api/webhook/sports-data` accepts API-Football format payloads (authenticated by `x-api-key` header vs `WEBHOOK_SECRET`). Frontend polls `/api/matches` every 5 seconds (`src/hooks/useMatchPolling.ts`) and detects goal events by diffing scores.

## Environment Variables

Requires `.env.local` (Drizzle config) and `.env` (runtime):
- `DATABASE_URL` / `POSTGRES_URL` — Postgres connection string
- `WEBHOOK_SECRET` — API key for the sports data webhook
- Firebase config lives in `firebase-applet-config.json` (client) and is hardcoded project ID in `src/lib/firebase-admin.ts` (server)

## Gotchas

- The Express app in `api/index.ts` uses `.js` extensions in imports (ESM on Vercel) even though source is TypeScript.
- `src/lib/engine.ts` (server) and `src/lib/rules.ts` + `src/lib/constants.ts` (client) define scoring/compliance independently — changes to point values or stage rules must be updated in both places.
- `drizzle.config.ts` loads env from `.env.local` specifically, not `.env`.
- The `@` path alias resolves to the project root, not `src/`.
- Admin seed endpoint (`POST /api/admin/seed`) auto-promotes the first user to global admin if none exist.
- Match lock time is kickoff minus 10 minutes — picks are rejected after lock time.
