# Security & Privacy

## Authentication & authorization

- Every `/v1` endpoint (except `/health` and signed webhooks) requires a **Firebase ID token**; verified with `firebase-admin` on each request.
- The WebSocket authenticates with the same token as its first frame; sockets without valid auth are closed and their audio dropped.
- Users are scoped by row: all queries filter on the authenticated `user_id`. There are no admin endpoints yet (roadmap: separate admin surface with IAM).
- RevenueCat webhook: `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` checked before processing.

## Abuse & cost protection

| Layer | Control |
| --- | --- |
| HTTP | 120 req/min per client (fastify rate-limit) |
| Live session | 10 turns/min per socket · hard wall-clock cap per session |
| Plan | Monthly speaking minutes enforced at session creation (`402 plan_limit`) |
| Payload | 15 MB body limit (base64 audio) · 2 MB WS frame limit |
| Duplicates | `Idempotency-Key` on session creation |

## Data protection

- **Raw audio is ephemeral.** Assessment/drill audio is transcribed in memory and never persisted. Session audio refs are purged after 24 h unless the user opts into retention.
- **Transcripts are the record** and belong to the user; deleted with the account.
- **Hard deletion:** `DELETE /me` soft-deletes; the daily maintenance job permanently removes the account and every dependent row after 30 days — matching the in-app privacy copy.
- Auth headers are redacted from logs; logs carry no PII beyond user ids.
- TLS everywhere in production (platform-terminated); Postgres/Redis over provider-encrypted connections.

## Third-party data flow

| Provider | Data sent | Purpose |
| --- | --- | --- |
| OpenAI | Turn text, transcripts, drafts; turn audio (batch STT) | LLM/TTS/STT processing |
| Deepgram | Turn audio stream | Live transcription |
| Azure Speech | Drill audio + reference text | Pronunciation scoring |
| Firebase | Identity | Auth |
| RevenueCat | App-user id (Firebase UID) | Entitlements |
| Sentry / Helicone | Errors / LLM metadata | Observability |

The B2B DPA template and sub-processor annex live in the product's legal docs (Drive).

## Hardening roadmap

- Move idempotency + rate state to Redis (multi-instance correctness).
- Secret scanning + dependency audit (Dependabot) in CI.
- Structured audit log for account-level actions (export, delete).
- Pen-test pass before B2B contracts; SOC2 posture only if enterprise demand materializes.
