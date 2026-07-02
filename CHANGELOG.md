# Changelog — Lingoready API

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
