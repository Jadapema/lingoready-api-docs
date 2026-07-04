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
  "tts_voice": null,
  "reminder_time": "09:30",
  "persona_overrides": { "Ana": { "name": "María", "role": "my boss", "voice": "coral" } },
  "plan": "free", "monthly_minute_cap": 20, "monthly_minutes_used": 12
}
```

### `PATCH /me`
Any subset of: `name`, `country`, `native_language`, `ui_language`,
`goal` (`interview|meetings|writing|job`),
`profession` (`software|product|marketing|finance|sales|health|academic|generic`),
`daily_goal_minutes` (5–60), `voice_retention`,
`tts_voice` (a supported TTS voice, or `null` to use each coach's own),
`reminder_time` (`HH:MM`),
`fcm_token` (for push — the worker sends a "your report is ready" push via FCM
when session feedback finishes; dead tokens are cleared automatically),
`persona_overrides` (full-replacement map keyed by the catalog coach's
canonical name, e.g. `"Ana"`; each entry may set `name`, `role` and/or `voice`.
Live sessions role-play with that identity — the system prompt is rewritten —
and speak with that voice. Voice precedence: persona override → user
`tts_voice` → the scenario's `coach_voice` → `TTS_VOICE` env default).

### `GET /me/export`
Full data export (GDPR right of access): profile, subscription, every session
with turns and feedback, assessments, word bank, writing reviews. Rate-limited
to 3 requests/hour. The app offers it under Profile → "Export my data".

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
`estimated_minutes`, `coach_name`, `coach_voice` (the TTS voice this coach
speaks with; editable in the backoffice catalog), `win_conditions`,
`key_phrases`, `is_custom` and `locked` (computed from the user's plan;
custom scenarios are never locked).

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
| → | `{ "type": "turn_start", "mime_type": "audio/pcm;rate=16000" }` | recommended — sets the turn's audio format and pre-opens the STT connection while the user speaks |
| → | binary frames | audio chunks for the current turn — raw 16 kHz mono 16-bit PCM streamed live while speaking (preferred), or a container format (m4a/wav/ogg) uploaded at turn end |
| → | `{ "type": "audio_end", "mime_type": "audio/pcm;rate=16000" }` | end of turn |
| ← | `{ "type": "transcript_partial", "text": "…" }` | live STT partials (Deepgram only) |
| ← | `{ "type": "transcript_final", "text": "…" }` | your words |
| ← | `{ "type": "assistant_delta", "text": "…" }` | LLM tokens as they stream |
| ← | `{ "type": "assistant_audio", "seq": 0, "last": false, "audio_base64": "…", "mime_type": "audio/mpeg", "text": "…" }` | per-clause TTS (parallel synth, ordered delivery) — play in `seq` order; `text` is the sentence spoken (drives voice-synced captions); empty `audio_base64` = skip that `seq` |
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
All scores are on a 0–100 scale (the worker normalizes model output) and are
calibrated against evidence — the prompt receives the learner's turn count and
word total, and a session with under ~40 spoken words is capped below 45
server-side. `suggested_words` are topic-specific to the transcript, exclude
words already in the user's word bank, and are saved to it automatically
(`source: "session"`, deduplicated case-insensitively).

### `GET /sessions` — recent history (Progress screen)

## Writing coach

### `POST /writing/review`
```json
{ "text": "Hi, sorry to bother…", "channel": "slack", "tone": "friendly" }
```
`channel`: `slack|email|pr_review|proposal|linkedin|support` ·
`tone`: `friendly|formal|direct|concise|diplomatic|persuasive`
→ `{ "rewrite": "…", "score": 62, "strengths": ["…"], "changes": [{ "tag": "Grammar", "before": "…", "after": "…", "why": "…" }] }`
`score` grades the ORIGINAL draft 0–100; `why` explanations and `strengths`
come back in the user's UI language so learners fully understand the fixes.

### `GET /writing/history`
Last 20 reviews (`id`, `channel`, `tone`, `input_text`, `rewrite`, `changes`,
`score`, `created_at`).

## Word bank

- `GET /words` — list
- `POST /words` — `{ "word": "…", "note"?, "example"?, "source"? }`
- `POST /words/lookup` — `{ "word": "…", "context"? }` → `{ "word", "definition", "translation", "example" }`.
  Quick in-session dictionary (tap a caption word in the app): definition and
  translation come back in the user's UI language, the example stays in
  English. Rate-limited to 20/min.
- `PATCH /words/:id` — `{ "mastered"?: bool, "note"?: string }`
- `DELETE /words/:id`

## Drills

### `GET /drills`
Active drill catalog, ordered. Seeded with the 17-drill launch set and
editable from the backoffice — drills ship without an app release (the app
bundles a fallback copy for offline/first launch).
```json
{ "drills": [{ "id": "filler", "emoji": "🗣️", "title": "Filler words", "min": "2 min",
  "goal": "…", "rounds": 3, "tip": "…", "prompts": ["…"], "summary": "…", "kind": "filler" }] }
```
`kind` is the metric profile the app passes to `POST /drills/score`.

### `POST /drills/score`
Scores one drill round with STT + deterministic speech metrics (no LLM cost).
```json
{ "audio_base64": "…", "mime_type": "audio/m4a", "kind": "filler", "reference_text": "optional sentence", "target_word": "optional word" }
```
`kind` accepts any drill slug; kinds without a dedicated metric profile fall
back to generic coaching.
→
```json
{
  "transcript": "…", "wpm": 138, "fillers": 1, "filler_words": ["um"],
  "trail_offs": 0, "duration_seconds": 22,
  "feedback": "1 filler (um). Almost clean.",
  "word_used": null,
  "pronunciation": { "accuracy": 84, "fluency": 78, "words": [{ "word": "thorough", "accuracy": 61 }] }
}
```
`pronunciation` is null unless `reference_text` is sent and Azure is configured.
`target_word` (word-bank rounds — the app sends the word the round asked the
user to use) makes the feedback verify the word was actually said
(`word_used: true|false`) and bumps that word's `seen_count` when it was.

## Progress

### `GET /progress`
`{ "cefr_level", "goal", "streak_days", "daily_minutes": [{ "day", "minutes" }], "skills": { … } }`

## Voice preview

### `POST /tts/preview`
Short TTS clip for the "Hear David's voice" / "Hear the room" buttons on the
scenario brief and group lobby. Responses are cached in-memory (LRU, keyed by
normalized text + voice), and the route is rate-limited to 10/min per user.
```json
{ "text": "We'll design a URL shortener together…", "voice": "alloy" }
```
→ `{ "audio_base64": "…", "mime_type": "audio/mpeg" }`

`text` is 3–300 chars; `voice` is optional (defaults to `TTS_VOICE`, one of
the OpenAI TTS voices).

## Remote config

### `GET /config` (no auth)
Feature flags + minimum supported app version. Flags override via the
`FEATURE_FLAGS` env var (JSON).
```json
{ "min_app_version": "0.1.0", "features": { "custom_scenarios": true, "hands_free_vad": true, "…": true } }
```

## Admin (backoffice)

All `/admin/*` routes require the **admin** role (bootstrap via the
`ADMIN_EMAILS` env allowlist — matching accounts are promoted on sign-in).
Non-admins receive `403 forbidden`. Consumed by
[lingoready-backoffice](https://github.com/Jadapema/lingoready-backoffice).

| Endpoint | Purpose |
| --- | --- |
| `GET /admin/overview` | KPIs: users (total/new 7d/pending deletion), sessions (today/7d/minutes), AI spend (today/7d/30d), plan distribution, avg session score |
| `GET /admin/users?query=&page=` | Search/paginate users with plan, sessions count, lifetime spend |
| `GET /admin/users/:id` | Full detail: profile, recent sessions, spend by pipeline stage |
| `PATCH /admin/users/:id` | Change `plan`/`minute_cap`, grant/revoke `role`, `restore` soft-deleted accounts |
| `GET /admin/sessions?status=&page=` | Session monitor with user, scenario, difficulty, duration, score |
| `GET /admin/usage` | Daily cost by stage (30d) + top-10 spenders |
| `GET/POST /admin/scenarios` · `PATCH/DELETE /admin/scenarios/:id` | Catalog CRUD (delete blocked once a scenario has sessions) |
| `GET/POST /admin/drills` · `PATCH/DELETE /admin/drills/:id` | Quick-drill catalog CRUD (served to the app by `GET /drills`) |
| `GET /admin/feedback?page=` | Recent coach reports for prompt-quality review |
| `GET /admin/settings` · `PUT /admin/settings/:key` | Editable runtime settings; `feature_flags` and `min_app_version` are served by `GET /config` |

## Webhooks (server-to-server)

### `POST /webhooks/revenuecat`
Configure in RevenueCat with `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`.
Maps entitlements to plans (`pro` → unlimited minutes, `standard` → 300/mo).
