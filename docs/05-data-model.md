# Data Model

PostgreSQL via Drizzle ORM. Conventions: UUID PKs, `created_at`/`updated_at` everywhere, JSONB for AI outputs (evolve without migrations), FKs indexed.

## Tables

| Table | Purpose | Notable fields |
| --- | --- | --- |
| `users` | Profile + preferences | `firebase_uid` (unique), `cefr_level`, `goal`, `profession`, `daily_goal_minutes`, `voice_retention`, `fcm_token`, `reminder_time`, `deleted_at` (soft delete) |
| `subscriptions` | Plan + entitlements | `plan` (free/standard/pro), `provider`, `monthly_minute_cap` (0 = unlimited), `current_period_end` |
| `scenarios` | Practice catalog | `slug`, `path_slug` + `order_in_path`, `difficulty`, `role_prompt`, `win_conditions[]`, `key_phrases[]`, `coach_name/role`, `is_free` |
| `sessions` | One practice run | `kind` (scenario/drill/group), `mode` (voice/chat), `status` (created→live→processing→done), `duration_seconds` |
| `turns` | Transcript lines | `role` (user/assistant), `text`, `audio_url` (ephemeral), `ts` |
| `feedback` | Post-session report | `overall_score`, `scores` JSONB, `fixes[]` (said/better/tag/why), `did_well[]`, `suggested_words[]`, `model` |
| `assessments` | Level checks | `answers[]`, `cefr_estimate`, `breakdown` JSONB, `takeaways[]` |
| `writing_reviews` | Writing coach history | `channel`, `tone`, `input_text`, `rewrite`, `changes[]`, `tokens_used` |
| `words` | Personal word bank | `word`, `note`, `example`, `mastered`, `seen_count`, `source` (manual/session) |
| `usage_events` | Cost metering | `type` (stt/llm/tts/pron), `provider`, `units`, `cost_usd`, indexed `(user_id, ts)` |
| `progress_weekly` | Rollups for fast reads | `active_minutes`, `sessions_count`, `level_snapshot`, `skill_snapshot` |

## Relationships

- `user 1—1 subscription`, `1—N sessions/assessments/writing_reviews/words/usage_events`.
- `session N—1 scenario`, `1—N turns`, `1—1 feedback`.
- `usage_events` roll up into per-user cost/margin reporting and the daily spend alert.

## Retention & deletion rules (enforced by the daily maintenance job)

| Data | Rule |
| --- | --- |
| Raw audio | Never persisted for assessments/drills; session `audio_url` refs nulled after 24 h unless `voice_retention = true` |
| Transcripts & feedback | Kept while the account exists (they are the product record) |
| Soft-deleted accounts | `deleted_at` set by `DELETE /me`; **hard-deleted with all dependent rows after 30 days** |

## Migrations

Generated from the schema: `npm run db:generate` → SQL in `drizzle/`, applied with `npm run db:migrate`. Must stay backward-compatible with the previous release (expand-then-contract across two deploys).
