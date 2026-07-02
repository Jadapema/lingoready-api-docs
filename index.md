---
layout: home

hero:
  name: Lingoready API
  text: Developer Documentation
  tagline: REST + WebSocket backend for the AI English voice coach
  actions:
    - theme: brand
      text: Get started
      link: /docs/01-overview
    - theme: alt
      text: API Reference
      link: /docs/03-api-reference
    - theme: alt
      text: Live status
      link: https://jadapema.github.io/lingoready-status/

features:
  - icon: ⚡
    title: Streaming voice pipeline
    details: STT partials while the user speaks, LLM deltas as the coach thinks, per-sentence TTS — first audio in ~1 second.
  - icon: 🧾
    title: Full protocol reference
    details: Every REST endpoint and every WebSocket frame documented with shapes, limits and error codes.
  - icon: 🛡️
    title: Guardrails built in
    details: Plan minute caps, per-session limits, turn rate-limiting, idempotency, metered costs per call.
  - icon: 📟
    title: Operations-ready
    details: Deployment runbooks, incident playbooks, monitoring priorities and a public status page.
---
