# WebSocket Protocol — Live Voice Session

Endpoint: `WSS /v1/sessions/:id/live` (session created via `POST /v1/sessions`).

All control frames are JSON text; **audio uploads are raw binary frames**.

## Handshake

| # | Direction | Frame |
| --- | --- | --- |
| 1 | → | `{ "type": "auth", "token": "<Firebase ID token>" }` — must be the first frame |
| 2 | ← | `{ "type": "ready" }` — authenticated; a hard session timer starts (`SESSION_MAX_SECONDS`) |

Binary frames before auth are dropped. Invalid token → `{ type: "error", code: "unauthorized" }` + close.

## One voice turn

| # | Direction | Frame | Notes |
| --- | --- | --- | --- |
| 0 | → | `{ "type": "turn_start", "mime_type": "audio/pcm;rate=16000" }` | Recommended: send when recording starts. Sets the turn's audio format and pre-opens the STT connection off the critical path |
| 1 | → | binary frames (≤256 KB each) | Audio chunks. Preferred: raw 16 kHz mono 16-bit PCM streamed **while the user speaks** (the reference app does this) — STT transcribes in real time and `transcript_final` is near-instant after `audio_end`. Container formats (m4a/wav/ogg) uploaded at turn end also work |
| 2 | ← | `{ "type": "transcript_partial", "text" }` | Live captions (Deepgram only), repeated |
| 3 | → | `{ "type": "audio_end", "mime_type": "audio/m4a" }` | Closes the user's turn |
| 4 | ← | `{ "type": "transcript_final", "text" }` | Empty text = nothing intelligible; turn aborts quietly |
| 5 | ← | `{ "type": "assistant_delta", "text" }` | LLM tokens, repeated — render as "coach is speaking" |
| 6 | ← | `{ "type": "assistant_audio", "seq": n, "last": bool, "audio_base64", "mime_type": "audio/mpeg" }` | One frame **per clause/sentence**, ordered by `seq`; sentences synthesize in parallel server-side but always arrive in order. An empty `audio_base64` means that `seq` was skipped (failed synth or end-marker) — advance past it |
| 7 | ← | `{ "type": "assistant_text", "text" }` | Full reply; turn is closed and persisted |

## Control frames

| Direction | Frame | Meaning |
| --- | --- | --- |
| → | `{ "type": "barge_in" }` | User interrupted playback — server stops queuing TTS for the current reply; client should also flush its local audio queue |
| → | `{ "type": "end" }` | Graceful close |
| ← | `{ "type": "session_cap_reached" }` | Hard per-session cap hit; socket closes after |
| ← | `{ "type": "error", "code", "message" }` | `rate_limited` (>10 turns/min — recoverable) · `unauthorized` · `not_found` · `internal` (fatal) |

## Client obligations

1. Send `auth` first; wait for `ready` before audio.
2. Send `turn_start` when the mic opens — it sets the turn's audio format and shaves the STT handshake (~300 ms) off the reply time. Raw PCM (`audio/pcm;rate=16000`) requires it before the first binary frame.
3. Chunk uploads ≤256 KB (server frame limit 2 MB).
4. Play `assistant_audio` strictly in `seq` order; any frame with empty audio (skipped synth or `last: true` end-marker) must still advance the sequence.
5. On disconnect: reconnect with backoff and re-auth — server-side session state survives (context lives in Postgres). The reference client queues one pending turn while offline.
6. Call `POST /v1/sessions/:id/end` after closing to trigger feedback generation.

## Timing expectations

With Deepgram configured **and live PCM streaming** (audio transcribed while the user speaks), `transcript_final` typically lands <150 ms after `audio_end`, and the first `assistant_audio` ~0.6–1.2 s later. With end-of-turn uploads add the upload + transcription time; with batch fallback add 0.8–2 s. See [AI Pipeline](06-ai-pipeline.md) for the full budget.
