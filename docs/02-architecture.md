# Architecture

## Module layout

```
src/
  adapters/        AI providers behind interfaces
    llm/openai     complete + completeStream (token deltas)
    stt/openai     batch transcription
    stt/deepgram-live  streaming STT (WS) + batch fallback wrapper
    tts/openai     sentence synthesis
    pronunciation/azure  per-word scoring
  config/env.ts    zod-validated env — fails fast on bad config
  db/              Drizzle schema + client (PostgreSQL)
  lib/             errors, sentence assembler, idempotency
  plugins/         Firebase auth (verify + auto-provision)
  queue/           BullMQ queues + worker (feedback, daily maintenance)
  routes/          REST endpoints (all under /v1)
  services/        prompts (versioned), feedback, assessment, writing,
                   usage metering, drill metrics, maintenance
  ws/              live-session socket + conversation turn logic
```

## The streaming turn (core loop)

```
turn_start ──► SttStream pre-opened (handshake off the critical path)
binary audio ──► SttStream (Deepgram live │ batch fallback)
                     │ partials → transcript_partial
audio_end ──► finish() → transcript_final
                     │        (session row prefetched in parallel)
                     ▼
        runChatTurnStream (gpt-4o-mini, windowed history)
                     │ onDelta → assistant_delta
                     ▼
     SentenceAssembler (eager first clause, then closed sentences)
                     │ per clause: synth starts immediately (parallel)
                     ▼
        TTS synthesize → assistant_audio {seq, last} (ordered delivery)
                     ▼
              assistant_text (turn closed, persisted)
```

Key properties:

- **The coach starts speaking after the first clause**, not the full reply — the assembler emits the opening clause at a comma once ~24 chars have buffered, then whole sentences.
- Sentence TTS **synthesizes in parallel** but delivery is chained, so chunks arrive in `seq` order; a failed synth sends an empty frame so the client's AudioQueue never stalls.
- Usage metering (`recordUsage`) is fire-and-forget — it never sits between the pipeline and a frame heading to the client.
- **Barge-in** sets a flag that stops queuing further TTS for the current reply.
- Turn handling is guarded: duplicate `audio_end` while busy is dropped; >10 turns/min → `rate_limited` error frame.

## Queues & scheduled work

| Queue | Trigger | Work |
| --- | --- | --- |
| `feedback` | `POST /sessions/:id/end` | GPT-4o structured report → `feedback` row; 3 attempts, exponential backoff |
| `maintenance` | Daily 04:30 UTC (job scheduler) | Null audio refs >24h for non-retention users; hard-delete accounts soft-deleted >30 days |

## Degradation ladder

| Failure | Behavior |
| --- | --- |
| No Deepgram key / stream fails | Batch STT per turn (no partials, higher latency, same correctness) |
| Azure missing/erroring | Drill scoring returns metrics without pronunciation |
| TTS chunk fails | Turn continues; client shows text |
| Feedback job fails ×3 | Session stays `processing`; visible in queue metrics (alerting: roadmap) |
| Redis down | API serves REST; session end returns 500 (feedback enqueue) — acceptable pre-launch, circuit-breaker on roadmap |

## Scaling notes

- REST is stateless → add instances behind the platform LB.
- Live WS sessions pin to their instance; per-session context is in Postgres, so reconnection to another instance works. Idempotency/turn-rate state must move to Redis before multi-instance (roadmap P1).
- The worker scales by concurrency setting; feedback jobs are independent.
