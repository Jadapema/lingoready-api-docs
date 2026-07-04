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
| 0 | → | `{ "type": "turn_start", "mime_type": "audio/pcm;rate=16000", "pace": "normal" }` | Recommended: send when recording starts. Sets the turn's audio format, pre-opens the STT connection off the critical path, and tunes the server's endpointing (`pace`: `fast` 300 ms · `normal` 400 ms · `relaxed` 600 ms of silence) |
| 1 | → | binary frames (≤256 KB each) | Audio chunks, only accepted **while a turn is open**. Preferred: raw 16 kHz mono 16-bit PCM streamed **while the user speaks** (the reference app does this) — STT transcribes in real time and the server can end the turn itself. Container formats (m4a/wav/ogg) uploaded at turn end also work |
| 2 | ← | `{ "type": "transcript_partial", "text" }` | Live captions (Deepgram only), repeated |
| 3a | ← | `{ "type": "turn_ended" }` | **Server-side turn end** (live streaming only): the STT endpointer heard the user finish and a *semantic hold* confirmed it — a closed sentence ends the turn in ~120 ms extra, a trailing "and…" waits ~950 ms for the speaker to resume (new words cancel the close). The client must stop treating the turn as open and skip its own `audio_end`; the reply is already being generated. This is the fastest path: no client silence timer, no `audio_end` round trip, no STT close wait |
| 3b | → | `{ "type": "audio_end", "mime_type": "audio/m4a" }` | Client-side close — the fallback when `turn_ended` didn't fire (client VAD timeout, file uploads, batch STT). After a `turn_ended`, the server swallows exactly one stale `audio_end` so a racing client fallback can't double-close |
| 4 | ← | `{ "type": "transcript_final", "text" }` | Empty text = nothing intelligible; turn aborts quietly |
| 5 | ← | `{ "type": "assistant_delta", "text" }` | LLM tokens, repeated — render as "coach is speaking" |
| 6 | ← | `{ "type": "assistant_audio", "seq": n, "last": bool, "audio_base64", "mime_type": "audio/mpeg", "text": "…" }` | One frame **per clause/sentence**, ordered by `seq`; sentences synthesize in parallel server-side but always arrive in order. `text` carries the sentence being spoken so the client can grow captions in sync with the voice. An empty `audio_base64` means that `seq` was skipped (failed synth or end-marker) — advance past it |
| 7 | ← | `{ "type": "assistant_text", "text" }` | Full reply; turn is closed and persisted. Not sent when the reply was barged-in (the client already moved on) |
| ∥ | ← | `{ "type": "correction", "original", "corrected", "note", "tag" }` | **Real-time correction** of the user's utterance, generated in parallel with the reply (never delays the voice). `note` is written in the user's UI language; `tag` ∈ `grammar · vocabulary · tense · word-order · phrasing`. Only clear, high-value errors fire; also persisted on the user's turn row |

## Control frames

| Direction | Frame | Meaning |
| --- | --- | --- |
| → | `{ "type": "barge_in" }` | User interrupted playback — server stops queuing TTS **and aborts the in-flight LLM stream**; whatever text already streamed persists as the assistant turn. Client should also flush its local audio queue |
| → | `{ "type": "turn_cancel" }` | Discard the open turn entirely (the user paused mid-sentence): no transcript, no reply, STT stream closed |
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

With Deepgram configured **and live PCM streaming**, the server ends the turn itself (`turn_ended`) ~420–550 ms after the user's last word for a finished sentence (300–400 ms endpointing + ~120 ms semantic hold), and the reply starts immediately from the already-final transcript — no `audio_end` hop, no STT close wait. Turn context (scenario/user/history) is cached in memory per socket, so nothing sits between the transcript and the LLM call; the first `assistant_audio` typically lands ~0.7–1.3 s after the user stops talking. With client-side `audio_end` closes add the round trip + STT finalization; with batch fallback add 0.8–2 s. See [AI Pipeline](06-ai-pipeline.md) for the full budget.

## Group rooms — multi-agent (`/v1/group-sessions/:id/live`)

Same transport and handshake, extended for several AI speakers. Create the
session with [`POST /group-sessions`](03-api-reference.md#group-rooms), then
connect to the returned `ws_path`.

The **server drives the room**: a deterministic beat plan (host opens → an
agent reacts and hands the floor → learner turn → agents react to what the
learner actually said → … → host wraps) decides *who* speaks *when*, while
every line is generated live by that agent's persona against the real
transcript. Each agent has its own TTS voice (user persona-voice overrides
apply).

Differences from the 1:1 protocol:

| Direction | Frame | Meaning |
| --- | --- | --- |
| ← | `{ "type": "agent_turn_start", "speaker": "Ana", "role": "Scrum lead", "turn": 0 }` | an agent is about to speak |
| ← | `assistant_delta` / `assistant_audio` / `assistant_text` | as in 1:1, plus `speaker` and `turn` on every frame |
| ← | `{ "type": "your_turn", "prompt": "Your turn: yesterday, today, blockers.", "turn": 3 }` | the room hands the learner the floor; audio uploads are only accepted while a user turn is open |
| ← | `{ "type": "room_done" }` | beat plan finished — call `POST /v1/sessions/:id/end` for the feedback report |

Notes:

- `seq` in `assistant_audio` increases **across the whole session** (not per
  reply), so the client's ordered audio queue never resets between speakers.
- An empty `transcript_final` re-sends `your_turn` with the same prompt — the
  learner keeps the floor.
- Turns persist with a `speaker` column; the feedback worker labels each agent
  by name in the transcript it grades.
