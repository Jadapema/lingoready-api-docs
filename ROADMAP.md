# Roadmap — API

Prioritized plan toward a genuinely robust, low-latency backend. Companion to the app roadmap in [lingoready-app-docs](https://github.com/Jadapema/lingoready-app-docs).

## P0 — Latency (first coach audio ≤ 1.2 s consistently)

| Item | Impact | Sketch |
| --- | --- | --- |
| **Server-side VAD endpointing** | Removes the human tap-to-stop delay entirely | Deepgram endpointing events close the turn automatically; emit `turn_ready` so the client stops the recorder |
| **Provider prompt caching** | −30–50% turn TTFT on long sessions | Cache the static system+scenario prefix (OpenAI prompt caching); keep history window stable-ordered |
| **TTS phrase cache** | Coach openers/backchannels play in ~0 ms | LRU of synthesized common sentences (per voice) in Redis/disk |
| **Speculative "thinking" audio** | Masks LLM TTFT | Pre-synthesized short acknowledgments streamed immediately after `transcript_final` |
| **Region co-location** | Cuts 100–300 ms RTT | Deploy API in the same region as OpenAI/Deepgram edge (us-east); measure per-segment timings first |
| **Turn telemetry** | Can't optimize what we don't measure | Record per-segment ms (stt/llm-ttft/tts-first/total) into `usage_events.meta`; p50/p95 dashboard |

## P1 — Reliability & scale-out

| Item | Why | Sketch |
| --- | --- | --- |
| **Redis-backed idempotency + turn rate state** | Current in-memory state breaks with >1 instance | SETNX with TTL; same interface |
| **Provider failover** | OpenAI hiccups shouldn't kill sessions | Adapter-level retry with jitter + secondary LLM/TTS provider (Anthropic/ElevenLabs) behind a circuit breaker |
| **Graceful WS drain on deploys** | Live sessions across restarts | SIGTERM → stop accepting, notify sockets (`server_restarting`), let clients reconnect (already supported app-side) |
| **Feedback streaming** | Kill the 8–15 s post-session dead wait | Stream feedback JSON progressively (SSE or WS) — hero score first, fixes as they generate |
| **Integration tests against real Postgres** | Unit tests don't cover routes | Testcontainers (Postgres+Redis) suite in CI: auth, session lifecycle, caps, webhook |
| **Load test** | Validate WS concurrency + queue depth | k6 scenario: 200 concurrent voice sessions; alert thresholds from results |
| **Backups & restore drill** | PITR is only real if rehearsed | Document + rehearse a restore on staging quarterly |

## P2 — Product-side API work

| Item | Notes |
| --- | --- |
| Session options: `duration_minutes`, `difficulty`, `coach_voice`, `speech_speed` on `POST /sessions` | Prompt + TTS voice routing; enables the app's pre-session sheet |
| Custom scenarios: `POST /scenarios/custom` | One LLM call drafts role_prompt + win conditions from the user's description; stored per-user |
| Job-description interview mode | `POST /interview-prep` ingests a JD → generates a tailored interview loop |
| Push campaigns worker | Streak reminders + weekly report via FCM tokens already stored |
| `GET /config` (feature flags + minimum app version) | Lets the app dark-launch features and force-upgrade |
| LLM eval harness in CI | Graded fixture transcripts; block prompt regressions |
| Real multi-party rooms (exploratory) | LiveKit SFU + agent participants — the path to live cohort rooms |

## Done (for reference)

- ✅ Streaming pipeline (LLM deltas + per-sentence TTS), Deepgram live STT with batch fallback
- ✅ Drill scoring, idempotent session creation, turn rate limiting
- ✅ Daily maintenance (audio purge, 30-day account deletion), Helicone hook
- ✅ 13 unit tests, ESLint, CI
