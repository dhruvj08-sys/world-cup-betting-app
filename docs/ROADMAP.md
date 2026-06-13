# Implementation Roadmap

Phase 1: Domain Foundation & Auth (Completed)
- [x] Basic routing and Auth check (Firebase Auth).
- [x] Database Schema Definitions (Drizzle ORM + PG).
- [x] Shared TypeScript definitions (lib/types.ts).
- [x] Shared constants and rule definitions (lib/constants.ts).
- [x] Core utility functions for time and compliance (lib/time.ts, lib/rules.ts).

Phase 2: Core Data Engine (Server-side)
- [ ] Implement robust server-side rule engine utilizing `lib/rules.ts`.
- [ ] Implement sync mechanism to fetch live fixtures from external data provider.
- [ ] Build settlement background worker (score update -> apply points -> persist events).
- [ ] Build compliance tracking cron job (calculates cycle windows and flags violations).

Phase 3: User Experience Iteration
- [x] Collapsible Sidebar navigation.
- [x] Dark, high-contrast, premium interface ("Elegant Dark").
- [ ] Dynamic Group Intel / Activity Feed populated from live data instead of mock Whatsapp chat.
- [ ] Client-side visual timer hooks for fluid countdowns to match locks.

Phase 4: Admin Capabilities
- [ ] Admin Dashboard UI.
- [ ] Ability to manually void a match (set poolStatus to 'excluded').
- [ ] Manual settlement overrides.

Phase 5: Refinement
- [ ] Full error boundaries and toast notifications.
- [ ] Push notifications / FCM integration for impending locks.
- [ ] End-to-end load testing.
