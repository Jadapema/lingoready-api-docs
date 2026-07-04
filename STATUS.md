# Status

_Last updated: 2026-07-04_

**Stage: pre-launch.** All MVP capabilities are implemented and tested locally. Items marked 🔑 activate with configuration only.

## Capability matrix

### Core services

| Capability | Status | Notes |
| --- | --- | --- |
| Firebase-token auth + user auto-provisioning | ✅ Done | Free plan seeded on first request |
| Scenario catalog (38 scenarios, 4 paths) | ✅ Done | Seed script; plan-based locking |
| Live voice sessions (WS) | ✅ Done | Streaming protocol below |
| — LLM reply streaming (`assistant_delta`) | ✅ Done | gpt-4o-mini |
| — Per-clause TTS chunks (`assistant_audio` seq) | ✅ Done | Parallel synth, ordered delivery; coach speaks after the first clause |
| — Live STT partials | 🔑 Config-gated | `DEEPGRAM_API_KEY`; batch fallback otherwise |
| — Live PCM streaming (`audio/pcm;rate=16000`) | ✅ Done | Transcribed while the user speaks; WAV-wrap for batch fallback |
| — Coach voices (`coach_voice` / user `tts_voice`) | ✅ Done | Backoffice catalog + user preference |
| — Barge-in handling | ✅ Done | Stops TTS queuing server-side |
| Chat-mode turns (REST) | ✅ Done | Same session/transcript |
| Post-session feedback (queued worker) | ✅ Done | GPT-4o, strict JSON schema, 2 fixes |
| CEFR assessment (4 answers → estimate) | ✅ Done | Audio never persisted |
| Drill scoring (`/drills/score`) | ✅ Done | STT + deterministic metrics; zero LLM cost |
| Group rooms — multi-agent live sessions | ✅ Done | 10 rooms × 3 AI personas with own voices; deterministic beat plan, agents react to the learner's real words |
| Word-level pronunciation | 🔑 Config-gated | `AZURE_SPEECH_KEY`; degrades gracefully |
| Writing coach | ✅ Done | Structured rewrite + explained changes |
| Word bank CRUD | ✅ Done | |
| Progress aggregation (streak, minutes, skills) | ✅ Done | |
| RevenueCat webhook → entitlements | ✅ Done | Needs `REVENUECAT_WEBHOOK_SECRET` in prod |

### Guardrails & operations

| Capability | Status | Notes |
| --- | --- | --- |
| Per-session hard time cap | ✅ Done | `SESSION_MAX_SECONDS` (default 15 min) |
| Monthly speaking-minutes cap per plan | ✅ Done | Free 20 · Standard 300 · Pro unlimited |
| Turn rate limit (10/min per live session) | ✅ Done | |
| HTTP rate limit (120/min) | ✅ Done | |
| Idempotency on session creation | ✅ Done | In-memory (single instance); Redis when scaling out |
| Usage metering + unit costs | ✅ Done | `usage_events` per STT/LLM/TTS/pron call |
| Daily maintenance job | ✅ Done | Audio-ref purge (24h) + 30-day account hard-delete |
| LLM observability (Helicone) | 🔑 Config-gated | `HELICONE_API_KEY` |
| Error tracking (Sentry) | 🔑 Config-gated | `SENTRY_DSN` |
| Unit tests (13) + CI | ✅ Done | Sentence splitter, drill metrics, prompts/schemas |

## Pending external configuration (no code required)

1. **OpenAI API key** (required) — LLM turns, feedback, TTS, batch STT.
2. **Firebase service account** (required) — token verification; same project as the app.
3. **Hosting** — Railway/Fly.io + managed Postgres (Neon/Supabase) + managed Redis (Upstash). Runbook in [deployment docs](docs/08-deployment-operations.md).
4. Optional: `DEEPGRAM_API_KEY` (live captions), `AZURE_SPEECH_KEY` (pronunciation), `HELICONE_API_KEY` (LLM traces), `SENTRY_DSN`, `REVENUECAT_WEBHOOK_SECRET`.

## Known limitations

- Idempotency + turn-rate state is in-process — fine for one API instance; move to Redis before scaling horizontally.
- Live sessions pin to the instance that holds the WS (stateless otherwise); sticky routing or a session broker needed at scale.
- Feedback generation is not streamed to the client yet (single JSON when done) — roadmap item.
- No load tests yet; latency numbers in the [AI pipeline doc](docs/06-ai-pipeline.md) are budget targets pending real-world measurement.
