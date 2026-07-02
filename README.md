# Lingoready API — Documentation & Status

Documentation hub for the **Lingoready backend** — the REST + WebSocket API that powers the AI English coach (live voice sessions, assessments, feedback, drills, writing coach, billing).

| | |
| --- | --- |
| **Code repository** | [Jadapema/lingoready-api](https://github.com/Jadapema/lingoready-api) |
| **App docs** | [Jadapema/lingoready-app-docs](https://github.com/Jadapema/lingoready-app-docs) |
| **Runtime** | Node.js 20 · Fastify 5 · PostgreSQL · Redis |
| **Stage** | Pre-launch — feature-complete MVP, pending provider keys & hosting (see [STATUS](STATUS.md)) |

## 📚 Documentation

| Document | What it covers |
| --- | --- |
| [Overview](docs/01-overview.md) | Responsibilities, principles, service map |
| [Architecture](docs/02-architecture.md) | Components, streaming pipeline, queues, degradation ladder |
| [REST Reference](docs/03-api-reference.md) | Every endpoint with request/response shapes |
| [WebSocket Protocol](docs/04-websocket-protocol.md) | The live-session protocol, frame by frame |
| [Data Model](docs/05-data-model.md) | Tables, relationships, retention rules |
| [AI Pipeline](docs/06-ai-pipeline.md) | Models, prompts, latency budget, cost controls |
| [Setup](docs/07-setup.md) | Local environment, migrations, seeding |
| [Deployment & Operations](docs/08-deployment-operations.md) | Hosting, runbooks, monitoring, alerts |
| [Security & Privacy](docs/09-security-privacy.md) | Auth, rate limits, data retention, GDPR posture |

## 📊 Project state

- **[STATUS.md](STATUS.md)** — capability matrix, config-gated features, known limitations
- **[ROADMAP.md](ROADMAP.md)** — prioritized plan: latency, scale, reliability
- **[CHANGELOG.md](CHANGELOG.md)** — what shipped, when

## Quick facts

- **Streaming voice pipeline:** audio streams to STT while the user speaks (Deepgram, optional), the LLM reply streams token-by-token, and TTS is synthesized **per sentence** so the coach starts speaking after the first sentence.
- **Cost-aware by design:** cheap model for live turns, big model once per session for feedback; every audio second and token metered in `usage_events` with hard caps per session and plan.
- **Quality gates:** TypeScript strict, ESLint, 13 unit tests, CI on every push/PR.
