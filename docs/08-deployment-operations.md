# Deployment & Operations

## Target topology

| Concern | Choice |
| --- | --- |
| API + worker | Railway or Fly.io — same image, two processes (`npm run start`, `node dist/queue/feedback-worker.js`) |
| PostgreSQL | Neon or Supabase (PITR backups on) |
| Redis | Upstash / platform addon |
| Region | Co-locate with AI providers (us-east) — latency matters more than user proximity because every turn round-trips the providers |

## Release procedure

1. CI green on `main` (typecheck, lint, tests).
2. Deploy to **staging**; run `npm run db:migrate` as a release step **before** the new version starts. Migrations must be backward-compatible (expand-then-contract).
3. Smoke: `/health`, one full session via the app against staging, one drill score.
4. Promote to production; watch Sentry + logs for 30 min.
5. Rollback = platform previous release (schema stays compatible by rule).

## Monitoring & alerts (order of importance)

1. **Daily AI spend** — `select sum(cost_usd) from usage_events where ts > now() - interval '1 day';` alert at 2× the 7-day average. A runaway loop can burn the budget overnight — wire this first.
2. **Uptime** — external monitor on `/health`, phone alert.
3. **Sentry** — API + worker exceptions; alert on new issue types.
4. **Queue health** — feedback queue depth & failure count (BullMQ metrics); alert if oldest job >5 min.
5. **Turn latency** — p95 of per-segment timings once turn telemetry lands (roadmap P0).
6. **DB** — connections, storage, slow queries via the provider dashboard.

## Runbooks

### Feedback jobs piling up
Worker down or OpenAI erroring. Check worker logs → restart process → jobs retry automatically (3 attempts, exponential backoff). Stuck `processing` sessions can be re-enqueued by calling `POST /sessions/:id/end` again (idempotent state transition).

### OpenAI outage
Live turns and feedback fail; REST catalog/progress still work. Client degrades to chat with error toasts. Mitigation until provider failover ships (roadmap P1): set `LLM_TURN_MODEL`/`LLM_FEEDBACK_MODEL` to an available model family and redeploy.

### Deepgram outage
Zero user-facing breakage — turns silently use batch STT (higher latency, no partials). Verify by absence of `transcript_partial` frames.

### Redis outage
REST unaffected except `POST /sessions/:id/end` (enqueue fails → 500). Restore Redis; ask affected users to end the session again, or re-enqueue manually.

### Runaway spend
Check `usage_events` grouped by user/hour → identify the pattern → lower `SESSION_MAX_SECONDS` / plan caps via env + redeploy (takes effect immediately for new sessions).

### Restore drill (quarterly)
Restore the latest PITR snapshot into a scratch database, point a staging instance at it, run the smoke test. Document the time-to-restore.

## Secrets

All secrets live in the platform's secret manager. The Firebase service-account JSON is mounted as a secret file. Nothing sensitive is ever committed — `.env` and `*service-account*.json` are git-ignored repo-wide.
