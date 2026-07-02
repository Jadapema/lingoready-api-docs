# AI Pipeline

The pipeline **is** the product. This page covers model routing, the latency budget, prompt architecture and cost controls.

## Model routing

| Stage | Model | Why | Runs |
| --- | --- | --- | --- |
| Live turns | `gpt-4o-mini` (streaming) | Cheap + fast; in-character quality is sufficient | Every turn |
| Post-session feedback | `gpt-4o` | The high-value output; accuracy matters | Once per session |
| Assessment scoring | `gpt-4o` | First impression must be right | Once per assessment |
| Writing coach | `gpt-4o-mini` | Stateless, structured output | Per request |
| Batch STT | `gpt-4o-mini-transcribe` | Cheap; assessments/drills/fallback | Per clip |
| Live STT | Deepgram `nova-3` (WS) | Low-latency partials | While speaking |
| TTS | `gpt-4o-mini-tts` | ~$0.015/min audio | Per sentence |
| Pronunciation | Azure Pronunciation Assessment | Purpose-built phoneme scoring | On reference-text drills |

All model ids are env-configurable (`LLM_TURN_MODEL`, `LLM_FEEDBACK_MODEL`, `TTS_MODEL`, `STT_BATCH_MODEL`); every provider sits behind an adapter interface — swapping vendors touches one file.

## Turn latency budget (voice → voice)

Target: **first coach audio ≤ 1.5 s** after the user stops speaking.

| Segment | With Deepgram (streaming) | Batch fallback |
| --- | --- | --- |
| STT final transcript | ~150–300 ms (already streamed) | 800–2000 ms (upload + transcribe) |
| LLM first sentence (streamed) | 300–600 ms | 300–600 ms |
| TTS first sentence | 300–500 ms | 300–500 ms |
| Network + playback start | ~150 ms | ~150 ms |
| **First audio heard** | **≈ 0.9–1.5 s** | **≈ 1.6–3.2 s** |

Levers already implemented: sentence-level TTS (don't wait for the full reply), token streaming, windowed history (last 12 turns → flat prompt size), turn model kept small. Next levers on the [roadmap](../ROADMAP.md): server-side VAD endpointing, TTS warm cache for recurrent coach phrases, provider prompt caching, region co-location.

## Prompt architecture (prompts are versioned code)

`src/services/prompts.ts`, `PROMPT_VERSION` tagged.

| Layer | Content |
| --- | --- |
| System / role | Coach identity, tone, hard rules (stay in character, one question at a time, ≤60 words) |
| Scenario | Context, win conditions, difficulty, learner's CEFR level |
| History | Last 12 turns (windowed) |
| Guardrails | On-topic, gentle corrections, never break character, no unsafe content |

Feedback / assessment / writing use **strict JSON schemas** (`response_format: json_schema`) so outputs render reliably and can be evaluated offline before a prompt change ships.

## Cost model & controls

Approximate unit economics (per 10-min voice session, cascaded pipeline):

| Item | Est. cost |
| --- | --- |
| STT (10 min) | ~$0.08 |
| Turn LLM (~15 turns, windowed) | ~$0.01 |
| TTS (~4 min coach speech) | ~$0.06 |
| Feedback (gpt-4o, once) | ~$0.02 |
| **Total** | **≈ $0.17 / session** → ~$3.40/mo for a daily-10-min user |

Controls in code: hard per-session seconds cap → WS closes · monthly minutes per plan enforced at session creation · 10 turns/min rate limit · history windowing · per-call cost recorded in `usage_events` (powers the daily-spend alert, the first alert to wire in production).

## Quality gate

Before changing any prompt: run the unit tests (schema shape), then evaluate against a transcript fixture set and compare feedback quality manually. Formal LLM evals (graded fixture suite in CI) are a roadmap item — see the LLM Evaluation Plan in the product docs.
