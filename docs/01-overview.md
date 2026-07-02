# Overview

## Responsibilities

The API is the orchestration layer between the mobile app and managed AI providers:

1. **Live practice sessions** — the streaming voice loop (STT → LLM → TTS) over WebSocket, plus chat turns over REST.
2. **Assessment** — spoken CEFR level checks, scored server-side.
3. **Feedback** — post-session analysis (queued, big model, once per session).
4. **Drills** — instant speech metrics (wpm, fillers, trail-offs, pronunciation).
5. **Writing coach** — structured rewrites with explained changes.
6. **Account & progress** — profile, word bank, streaks, skills, privacy controls.
7. **Billing** — entitlements from RevenueCat webhooks; plan limits enforced server-side.

## Principles

1. **Buy, don't build, the hard AI.** Managed STT/LLM/TTS behind swappable adapters; no model training.
2. **Thin backend, smart orchestration.** The moat is prompts + scenario logic + latency engineering, not infrastructure.
3. **Cost-aware by design.** Cheap model per turn, expensive model once per session; every second and token metered; caps are first-class.
4. **Stateless services + managed data.** Horizontal scaling is boring on purpose.
5. **Privacy first.** Raw audio is ephemeral; transcripts are the record; deletion promises are enforced by a scheduled job, not by policy text.

## Service map

```
                   ┌────────────── lingoready-app (Expo) ──────────────┐
                   │  REST /v1 (Bearer: Firebase ID token)   WSS live  │
                   └───────────────┬───────────────────┬───────────────┘
                                   ▼                   ▼
                          Fastify API  ◄──────  WebSocket handler
                          │        │                    │
              PostgreSQL ─┘        └─ Redis (BullMQ) ── feedback worker
              (Drizzle)                                 maintenance job (daily)
                          │
        Adapters: OpenAI (LLM/TTS/STT-batch) · Deepgram (STT-live)
                  Azure (pronunciation) · Helicone (traces, optional)
```

Two processes, one codebase: the API (HTTP + WS) and the worker (feedback queue + daily maintenance).

## Environments

| Env | Purpose |
| --- | --- |
| Local | docker-compose Postgres/Redis, real or dev AI keys |
| Staging | Production-like; migrations and prompt changes land here first |
| Production | Managed Postgres (PITR), managed Redis, Sentry + spend alerts on |
