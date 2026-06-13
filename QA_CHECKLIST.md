# QA & Hardening Checklist for Production Sharing

1. **Error Boundaries Implementation**:
   - [x] Global React Error Boundary (`ErrorBoundary.tsx`) applied at the root (`src/main.tsx`).
   - Ensures any unforeseen client-side crashes render a graceful failure state with a reload prompt instead of a blank screen.

2. **Empty, Loading, and Failure States**:
   - [x] Tested the empty state for "Next Matches".
   - [x] Tested empty audit logs view.
   - [x] Loading states clearly reflect initialization phases across client data fetching and room creation.
   - [x] Fallback empty lists initialized (so no `.map` of undefined errors occur).

3. **Strict Typing Cleanup**:
   - [x] Removed all implicit and explicit `any` usages from core rendering (`Dashboard.tsx`, `MatchCard.tsx`).
   - [x] Exported and utilized strongly typed `Match`, `Pick`, `DbUser`, `LeaderboardEntry`, etc., from `src/types.ts`.
   - [x] Safely casted error boundaries in catch statements with proper property checks (checking for message values properly).

4. **Memoization / Performance Review**:
   - [x] The `Dashboard` polling interval utilizes stable references.
   - [x] Memoization is largely deferred as the views depend heavily on real-time reactive slices (like locks changing by the minute). Client sizes are small enough without nested loops blocking frames.
   - [x] Pinned matches leverage `localStorage` which writes efficiently on toggles without forcing mass re-renders.

5. **Build and Deployment Safety Fixes**:
   - [x] Modified `vite.config.ts` integration with Express correctly to output server-safe `dist/` files bypassing common node ESM/CJS path resolution issues.
   - [x] Included robust `.dockerignore` blocking `.git`, `.env*` and `node_modules` from container image inflation.

6. **Firebase / Engine Configurations Review**:
   - [x] Firebase SDK leverages safe public payload configs (`firebase-applet-config.json`); No admin keys exposed to browser.
   - [x] Database strictly runs PostgreSQL from a dedicated isolated connection pooling (`src/db/index.ts`), correctly parsing standard env vars (`DATABASE_URL`).
   - [x] Real-time engine utilizes secure server bounds to evaluate compliance and match locking (trusting server time over client time).

7. **Ignore-File and Cache Safety**:
   - [x] Confirmed `.gitignore` successfully excludes `node_modules`, `dist`, local environment variables, and `coverage`.
   - [x] No cached artifacts push into cloud build processes.

8. **Remaining Risks / Summary**:
   - **Local Storage Desync**: Pinned matches are stored locally on the unit level. It correctly skips persistence loops but is isolated per-device.
   - **Time Skewing Warning**: The frontend lock-UI relies on `setInterval` parsing ISO strings against client `now`. Real locks are rigorously validated by the backend. If a client alters system time, they may see a button, but requests will be rejected by the server auth constraints. This is expected and safe behavior.
   - **Performance at high concurrent scale**: Fast-polling every 30s over simple HTTP works for mid-size friend rooms. Beyond that, a transition to WebSockets scale is recommended if 10k+ concurrent users exist purely polling the leaderboard.

All checks are completed. The environment is considered hardened for group distribution.
