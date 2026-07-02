# Changelog — Lingoready API

## [0.4.0] — 2026-07-02

### Added
- **Admin surface** for the backoffice: role-based access (`users.role`, `ADMIN_EMAILS` bootstrap, `requireAdmin` guard) and `/admin/*` endpoints — overview KPIs, user management (plans/caps/roles/restore), session monitor, usage & cost reporting, scenario catalog CRUD, feedback review, editable runtime settings.
- `app_settings` table; `GET /config` now merges backoffice settings > env > defaults (migration 0003).

## [0.3.0] — 2026-07-02

### Added
- **Catalog ×5:** seed expanded to 10 paths / ~125 scenarios (negotiation, client calls, difficult conversations, leadership, networking, career growth added).
- `POST /scenarios/custom` — AI-drafted user scenarios (structured LLM output, per-user, never plan-locked) + `DELETE /scenarios/:slug`.
- Session options on `POST /sessions`: `duration_minutes` (5/10/15 → per-session cap) and `difficulty` (easy/realistic/hard → coach behavior in the system prompt).
- `POST /sessions/:id/hint` — one whisper-phrase suggestion from the turn model.
- `GET /config` — remote feature flags + minimum app version (env-overridable).
- `drills/score` accepts `kind: generic` (group-room turns).
- Migration 0002: `scenarios.user_id`, `sessions.difficulty`, `sessions.max_seconds`.

## [0.2.0] — 2026-07-02

### Added
- **Streaming voice pipeline:** LLM turn replies stream token-by-token (`assistant_delta`); TTS synthesized per sentence and delivered as ordered `assistant_audio` chunks — first coach audio after the first sentence.
- **Deepgram live STT** (config-gated) with transcript partials; automatic batch fallback.
- `POST /drills/score` — STT + deterministic speech metrics (wpm, fillers, trail-offs) with optional Azure per-word pronunciation.
- Turn rate limiting (10/min per live session) and `Idempotency-Key` support on session creation.
- Daily maintenance job: audio-reference purge (24 h) and 30-day hard deletion of soft-deleted accounts.
- Helicone LLM observability hook (config-gated).
- Dedicated `answers` column on assessments (migration 0001).
- 13 unit tests (sentence assembler, drill metrics, prompts/schemas), ESLint flat config, GitHub Actions CI.

## [0.1.0] — 2026-07-02

### Added
- Initial API: Fastify 5 + Drizzle schema (users, subscriptions, scenarios, sessions, turns, feedback, assessments, writing_reviews, words, usage_events, progress_weekly) with initial migration and 38-scenario seed.
- Firebase ID-token auth with user auto-provisioning.
- Live-session WebSocket (turn-based STT→LLM→TTS), chat turns, session lifecycle + queued GPT-4o feedback reports.
- CEFR assessment flow, writing coach, word bank, progress aggregation.
- Usage metering with per-call costs, plan minute caps, per-session time cap.
- RevenueCat webhook → entitlements. Sentry wiring. docker-compose, .env.example, full docs.
