# API Reference

Base URL: `https://<host>/v1` — JSON everywhere, snake_case fields, UTC timestamps.

**Auth:** every endpoint (except `/health` and webhooks) requires
`Authorization: Bearer <Firebase ID token>`. Users are auto-provisioned on
first request.

**Errors:** `{ "error": { "code": string, "message": string, "details"?: any } }`
with a matching HTTP status. Notable codes: `unauthorized` (401),
`plan_limit` (402), `not_found` (404), `bad_request` (400).

## Profile

### `GET /me`
Current profile, plan and usage.
```json
{
  "id": "…", "email": "…", "name": "…",
  "cefr_level": "B1", "goal": "interview", "profession": "software",
  "ui_language": "es", "daily_goal_minutes": 15, "voice_retention": false,
  "reminder_time": "09:30",
  "plan": "free", "monthly_minute_cap": 20, "monthly_minutes_used": 12
}
```

### `PATCH /me`
Any subset of: `name`, `country`, `native_language`, `ui_language`,
`goal` (`interview|meetings|writing|job`),
`profession` (`software|product|marketing|finance|sales|health|academic|generic`),
`daily_goal_minutes` (5–60), `voice_retention`, `reminder_time` (`HH:MM`),
`fcm_token` (for push).

### `DELETE /me`
Soft-deletes the account (30-day purge window).

## Assessment (free level check)

### `POST /assessments` → `201 { "assessment_id": "…" }`

### `POST /assessments/:id/answers`
One spoken answer at a time.
```json
{ "audio_base64": "…", "mime_type": "audio/m4a", "question_index": 0 }
```
Response: `{ "transcript": "…", "done": false }`. On `question_index: 3` the
assessment is scored and `done: true` includes the result.

### `GET /assessments/:id`
```json
{
  "status": "done", "cefr_estimate": "B1",
  "breakdown": { "fluency": 66, "grammar": 71, "vocabulary": 82, "pronunciation": 74 },
  "takeaways": [{ "title": "…", "detail": "…" }]
}
```

## Scenarios

### `GET /scenarios`
Full catalog (10 paths, ~125 lessons) **plus the user's custom scenarios**.
Each item includes `path_slug`, `order_in_path`, `difficulty`,
`estimated_minutes`, `coach_name`, `win_conditions`, `key_phrases`,
`is_custom` and `locked` (computed from the user's plan; custom scenarios
are never locked).

### `GET /scenarios/:slug`
Single scenario (brief screen).

### `POST /scenarios/custom`
AI-drafted scenario from a free-text description — the anti-repetition
feature ("practice MY meeting tomorrow").
```json
{ "description": "Tomorrow I present our Q3 roadmap to leadership. My VP interrupts a lot…" }
```
→ `201` with the full scenario object (`path_slug: "custom"`). One
`LLM_FEEDBACK_MODEL` call, metered.

### `DELETE /scenarios/:slug`
Deletes one of the user's custom scenarios.

## Practice sessions

### `POST /sessions`
```json
{
  "scenario_slug": "interviews-13-system-design-interview",
  "mode": "voice",
  "duration_minutes": 10,
  "difficulty": "realistic"
}
```
→ `201 { "session_id": "…", "ws_path": "/v1/sessions/<id>/live" }`

- `duration_minutes` (5 | 10 | 15, optional) — per-session hard cap, bounded by the server cap.
- `difficulty` (`easy` | `realistic` | `hard`, default `realistic`) — adjusts coach pace, vocabulary and pushback.
- Fails with `402 plan_limit` when the monthly speaking cap is used up.

### `POST /sessions/:id/hint`
One whisper-phrase the learner could say next (cheap turn-model call).
→ `{ "hint": "\"Let me make sure I understand the constraint…\"" }`

### WebSocket `/v1/sessions/:id/live`

| Direction | Frame | Meaning |
| --- | --- | --- |
| → | `{ "type": "auth", "token": "<Firebase ID token>" }` | must be first |
| ← | `{ "type": "ready" }` | authenticated |
| → | binary frames | audio chunks for the current turn (streamed to STT live when Deepgram is configured) |
| → | `{ "type": "audio_end", "mime_type": "audio/m4a" }` | end of turn |
| ← | `{ "type": "transcript_partial", "text": "…" }` | live STT partials (Deepgram only) |
| ← | `{ "type": "transcript_final", "text": "…" }` | your words |
| ← | `{ "type": "assistant_delta", "text": "…" }` | LLM tokens as they stream |
| ← | `{ "type": "assistant_audio", "seq": 0, "last": false, "audio_base64": "…", "mime_type": "audio/mpeg" }` | per-sentence TTS — play in `seq` order as chunks arrive |
| ← | `{ "type": "assistant_text", "text": "…" }` | full reply (turn closed) |
| → | `{ "type": "barge_in" }` | user interrupted — server stops queuing TTS for this reply |
| → | `{ "type": "end" }` | close |
| ← | `{ "type": "session_cap_reached" }` | hard per-session cap hit |
| ← | `{ "type": "error", "code": "rate_limited" \| …, "message": "…" }` | `rate_limited` = >10 turns/min; others fatal |

`POST /sessions` accepts an optional `Idempotency-Key` header — repeated keys
within 60s return the original session instead of creating a duplicate.

### `POST /sessions/:id/turns` — chat mode
`{ "text": "…" }` → `{ "reply": "…" }`

### `POST /sessions/:id/end`
Marks the session done and enqueues feedback. → `{ "status": "processing" }`

### `GET /sessions/:id/feedback`
`{ "status": "processing", "feedback": null }` until ready, then:
```json
{
  "status": "done",
  "feedback": {
    "overall_score": 79,
    "scores": { "fluency": 72, "grammar": 78, "vocabulary": 84, "pronunciation": 80 },
    "headline": "You handled the pressure",
    "summary": "…",
    "fixes": [{ "said": "…", "better": "…", "tag": "Clarity", "why": "…" }],
    "did_well": ["…"],
    "suggested_words": ["stakeholder", "pivot"]
  }
}
```

### `GET /sessions` — recent history (Progress screen)

## Writing coach

### `POST /writing/review`
```json
{ "text": "Hi, sorry to bother…", "channel": "slack", "tone": "friendly" }
```
→ `{ "rewrite": "…", "changes": [{ "tag": "Grammar", "before": "…", "after": "…", "why": "…" }] }`

### `GET /writing/history`

## Word bank

- `GET /words` — list
- `POST /words` — `{ "word": "…", "note"?, "example"?, "source"? }`
- `PATCH /words/:id` — `{ "mastered"?: bool, "note"?: string }`
- `DELETE /words/:id`

## Drills

### `POST /drills/score`
Scores one drill round with STT + deterministic speech metrics (no LLM cost).
```json
{ "audio_base64": "…", "mime_type": "audio/m4a", "kind": "filler", "reference_text": "optional sentence" }
```
→
```json
{
  "transcript": "…", "wpm": 138, "fillers": 1, "filler_words": ["um"],
  "trail_offs": 0, "duration_seconds": 22,
  "feedback": "1 filler (um). Almost clean.",
  "pronunciation": { "accuracy": 84, "fluency": 78, "words": [{ "word": "thorough", "accuracy": 61 }] }
}
```
`pronunciation` is null unless `reference_text` is sent and Azure is configured.

## Progress

### `GET /progress`
`{ "cefr_level", "goal", "streak_days", "daily_minutes": [{ "day", "minutes" }], "skills": { … } }`

## Remote config

### `GET /config` (no auth)
Feature flags + minimum supported app version. Flags override via the
`FEATURE_FLAGS` env var (JSON).
```json
{ "min_app_version": "0.1.0", "features": { "custom_scenarios": true, "hands_free_vad": true, "…": true } }
```

## Webhooks (server-to-server)

### `POST /webhooks/revenuecat`
Configure in RevenueCat with `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`.
Maps entitlements to plans (`pro` → unlimited minutes, `standard` → 300/mo).
