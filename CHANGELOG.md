# Changelog — Lingoready API

## [0.7.0] — 2026-07-03

### Added
- **Live PCM streaming** on the session WebSocket: `turn_start` now sets the turn's audio format and pre-opens the STT connection; raw `audio/pcm;rate=16000` streams to Deepgram as linear16 while the user is still speaking (WAV-wrapped automatically for the batch STT fallback). `transcript_final` lands near-instantly after `audio_end`.
- **Coach voices** (migration 0005): `scenarios.coach_voice` — each coach speaks with its own TTS voice, editable in the backoffice catalog and returned by `GET /scenarios`; per-user `tts_voice` preference on `GET/PATCH /me` overrides it.

### Changed
- Streaming-turn latency: per-clause TTS synthesizes in parallel with ordered delivery (a failed clause sends an empty frame instead of stalling the client), the first clause splits eagerly at a comma, the session row is prefetched during STT finalization, prompt reads are batched, and usage metering no longer blocks frames to the client.

## [0.6.0] — 2026-07-03

### Added
- `GET /me/export` — full account data export (profile, sessions with turns & feedback, assessments, words, writing reviews); 3 req/hour rate limit.
- **Drill catalog in the DB** (migration 0004): `GET /drills` for the app, `GET/POST/PATCH/DELETE /admin/drills` for the backoffice, seeded with the 17-drill launch set.
- **Server-sent push notifications** (FCM via firebase-admin): the worker pushes "your session report is ready" when feedback generation completes; dead tokens are cleared automatically.

### Fixed
- `POST /drills/score` accepted only 7 `kind` values, so 11 of the 17 launch drills failed with 400 — any drill slug is now accepted, falling back to generic metrics.

## [0.5.0] — 2026-07-02

### Added
- `POST /tts/preview` — short TTS clips for the app's "Hear David's voice" / "Hear the room" buttons. In-memory LRU cache (normalized text + voice), 10 req/min per-route rate limit, optional `voice` override (defaults to `TTS_VOICE`).

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
