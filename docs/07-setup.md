# Setup

## Prerequisites

- Node.js 20+ · Docker (Postgres + Redis)
- Firebase project (shared with the app) — service-account JSON
- OpenAI API key

## Install & run

```bash
git clone git@github.com:Jadapema/lingoready-api.git
cd lingoready-api
docker compose up -d               # Postgres :5432 + Redis :6379
cp .env.example .env               # fill the table below
npm install
npm run db:generate && npm run db:migrate
npm run db:seed                    # 38-scenario catalog

npm run dev                        # API on :4000
npm run worker                     # terminal 2 — feedback + maintenance
```

Smoke test: `curl http://localhost:4000/health` → `{"ok":true,"version":"v1"}`

## Environment reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL`, `REDIS_URL` | ✅ | Defaults match docker-compose |
| `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | ✅ | Token verification (service-account JSON path) |
| `OPENAI_API_KEY` | ✅ | LLM, TTS, batch STT |
| `LLM_TURN_MODEL` / `LLM_FEEDBACK_MODEL` / `TTS_MODEL` / `TTS_VOICE` / `STT_BATCH_MODEL` | — | Model routing (sane defaults) |
| `SESSION_MAX_SECONDS`, `FREE_MONTHLY_MINUTES` | — | Cost guardrails |
| `DEEPGRAM_API_KEY` | optional | Live STT partials |
| `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` | optional | Pronunciation scoring |
| `HELICONE_API_KEY` | optional | LLM traces/caching proxy |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | optional | Error tracking |
| `REVENUECAT_WEBHOOK_SECRET` | prod | Webhook signature check |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `worker` | Hot-reload API / background worker |
| `npm run typecheck` · `lint` · `test` | Quality gates (CI runs all three) |
| `npm run db:generate` / `db:migrate` / `db:seed` | Schema lifecycle |

## Getting an auth token for manual testing

Requests need a Firebase **ID token**. Easiest paths:
1. Run the app against your local API and copy the token from a request log, or
2. Mint a custom token with the Admin SDK and exchange it via the Firebase Auth REST endpoint (`signInWithCustomToken`).

Users auto-provision on first authenticated request (free plan, 20 min/month).
