# Changelog — Lingoready API

## [0.10.0] — 2026-07-04

### Added
- **Server-side semantic turn-taking** (live sessions): Deepgram's endpointer (`speech_final`/`UtteranceEnd` + `vad_events`) now ends the user's turn on the server, debounced by a *semantic hold* — a closed sentence gets ~120 ms, a trailing "and…" waits ~950 ms for the speaker to resume, and any new words cancel the close (`src/lib/turn-taking.ts`). New `turn_ended` event; the reply starts from the already-final transcript with zero extra round trips. `turn_start` accepts `pace` (`fast`/`normal`/`relaxed`) to tune the endpointing window.
- **Real-time corrections**: every user turn (≥3 words) gets a parallel `LLM_CORRECTION_MODEL` JSON call that flags the single most valuable error — new `correction` WS event (`original`/`corrected`/`note`/`tag`, note in the user's UI language) that never delays the coach's voice. Migration 0009 persists it on the turn row (`turns.correction`).
- `turn_cancel` client frame: pausing mid-sentence discards the open turn (no transcript, no reply).

### Changed
- **Barge-in now aborts the in-flight LLM stream** (not just TTS delivery) — unheard tokens stop billing, and only what actually streamed persists as the assistant turn; the aborted reply sends no `assistant_text`.
- Turn context (scenario, user, history) is **cached in memory per socket** — no DB reads sit between the transcript and the LLM call; user/assistant turns persist asynchronously.
- Live turn model default bumped to `gpt-4.1-mini` (better in-character quality at the same latency class).
- Binary audio frames are only accepted while a turn is open — chunks in flight after a server-side turn end can't open stray STT streams.

### Fixed
- A turn endpointed while the previous reply was still flushing its TTS chain silently lost its auto-end; the hold timer now waits for the busy turn instead of dropping. Late signals from an already-taken STT stream can no longer touch the next turn's timers.
- `POST /tts/preview` accepts 2-character texts (the app's dictionary sheet pronounces single words like "go").
- **Container audio uploads (m4a) returned empty transcripts** whenever Deepgram was configured — Deepgram's live socket can't decode AAC, so every file-mode turn (the app's Expo Go fallback) came back as "Didn't catch that". `streamingStt(mime)` now routes non-PCM uploads to the batch transcriber (both 1:1 and group sockets).

## [0.9.0] — 2026-07-04

### Added
- **Group rooms are now real multi-agent conversations.** `POST /group-sessions` + WebSocket `/v1/group-sessions/:id/live`: each of the 10 rooms has three AI participants with their own persona, role and TTS voice (user persona-voice overrides apply). A deterministic beat plan guarantees the learner's speaking turns (host opens → agents react and hand the floor → learner → reactions to what the learner **actually said** → host wraps), while every agent line is generated live against the real transcript. Agent frames carry `speaker` + `turn`; `seq` is session-global so client audio queues never reset between speakers. See the [group protocol](/docs/04-websocket-protocol).
- Migration 0008: `turns.speaker` (which agent spoke) and `sessions.group_room_id`.
- Group sessions reuse `POST /sessions/:id/end` + `GET /sessions/:id/feedback` — the feedback worker now labels each agent by name in the graded transcript, and `GET /sessions` resolves group titles/emojis from the room catalog.

## [0.8.0] — 2026-07-04

### Added
- **Full automated test suite** (252 tests): route integration for all 13 route files against a throwaway Postgres (auth/admin guards, zod validation, rate limits, idempotency, RevenueCat webhook signature, plan caps), WebSocket protocol tests (PCM streaming, ordered TTS delivery, barge-in, voice precedence, session caps), BullMQ worker tests with a real Redis round-trip on an isolated queue prefix, and service tests for feedback scoring, usage metering and GDPR maintenance. See [Testing](/docs/10-testing).
- **App contract tests**: every response consumed by the mobile app is validated against zod mirrors of the app's types (`test/contract/`).
- **Live smoke scripts** (`npm run smoke`, `scripts/smoke/stt.ts`) for validating prompts/TTS/STT against real providers before releases, and **performance tools**: `npm run perf:http` (autocannon) and `npm run perf:ws` (time-to-first-coach-audio measurement).
- CI now runs the suite against Postgres+Redis service containers, plus a dedicated job applying all migrations to an empty database and running the catalog seed twice (idempotence check).

### Fixed
- `SentenceAssembler` silently dropped the text before a decimal number ("The budget is 3." vanished from TTS when the reply contained "3.5 million") — found by the new unit tests.
- The global error handler collapsed framework 4xx errors (rate-limit 429, payload-too-large 413) into generic 500s and reported them to Sentry as exceptions; they now reach the client with their real status and code.
- `suggested_words` deduplication against the word bank was case-sensitive in SQL, so a saved "Rollout" didn't block a suggested "rollout" — the bank filled with case-variant duplicates.

### Changed
- BullMQ queues take their key prefix from `BULLMQ_PREFIX` (default `bull`) so test jobs never reach the dev worker. **Restart the dev worker after pulling.**

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
