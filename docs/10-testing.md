# Testing

The API ships with a full automated test suite (unit, route integration,
WebSocket, worker, contract) plus live smoke scripts and performance tools.
Everything runs with `npm test` against a throwaway Postgres database.

## Layers

| Layer | Location | What it covers |
|---|---|---|
| Unit | `src/**/*.test.ts` | Pure logic: sentence splitter, WAV wrapper, idempotency, voices, errors, prompts, drill metrics, TTS preview cache |
| Route integration | `test/routes/` | All 13 route files via `app.inject()` against a real Postgres: auth/admin guards, zod validation, rate limits, idempotency, RevenueCat webhook, plan caps |
| Services | `test/services/` | Feedback generation (score normalization, evidence cap, word-bank dedupe), usage metering, GDPR maintenance |
| WebSocket | `test/ws/` | Live session protocol: auth, PCM streaming, ordered per-sentence TTS delivery, captions, barge-in, voice precedence, session caps, turn rate limit |
| Worker | `test/worker/` | BullMQ processors + a real Redis round-trip on an isolated queue prefix |
| Contract | `test/contract/` | Every response consumed by the mobile app validated against zod mirrors of the app's types |

## Running

```bash
npm test              # full suite (creates lingoready_test from scratch + migrations)
npm run test:watch
npm run test:coverage
```

Requirements: local Postgres and Redis (`npm run infra:up`). The global setup
**drops and recreates** `lingoready_test` on every run — each run doubles as a
"migrations apply from scratch" check. Tests never touch the dev database.

### Test isolation from the dev worker

BullMQ queues take their key prefix from `BULLMQ_PREFIX` (default `bull`).
Tests run with `lingoready-test` so jobs never leak between the suite and the
dev worker sharing the local Redis. **Restart your dev worker** after pulling
this change so it picks up the prefixed queue names.

## Live smoke tests (no CI)

Run before releases or after touching `prompts.ts` — they hit real providers:

```bash
npm run smoke                          # feedback prompt + TTS against OpenAI
npx tsx scripts/smoke/stt.ts turn.m4a  # batch STT with a real recording
```

## Performance

```bash
npm run perf:http                      # autocannon on /health (p95 gate)
TOKEN=<firebase-id-token> AUDIO_FILE=turn.m4a npm run perf:ws
```

`perf:ws` measures the number that matters: **time from `audio_end` to the
first coach audio frame**, plus transcript and first-LLM-delta latencies.

## Contract with the app

`test/contract/app-shapes.ts` mirrors the TypeScript types in
`lingoready-app/src/lib/api.ts` as zod schemas; `app-contract.test.ts`
validates real API responses against them. The app repo holds an identical
copy validating its MSW fixtures. Changing a response shape requires updating
the app types, both copies, and both tests — the suites fail loudly otherwise.

## CI

`.github/workflows/ci.yml` runs two jobs on every push/PR:

1. **checks** — typecheck, lint, and the full test suite against Postgres 16 +
   Redis 7 service containers.
2. **migrations-and-seed** — applies all drizzle migrations to an empty
   database and runs the full catalog seed twice (idempotence check). This is
   the deploy path rehearsal.
