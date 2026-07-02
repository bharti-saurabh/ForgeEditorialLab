# Forge — Editorial Lab

A compliance-first, **multi-model** AI content engine for a financial-services
marketing team. Forge takes a topic from *"what should we write about"* through
on-brand creation, an auditable legal-and-compliance gate, and synthetic
audience validation, to a publish-ready package — grounding every output in a
specific issuer's real brand and routing each task to the best model for the job.

Default brand: **Capital One** (synthetic / public-derived, clearly labelled).

> **This is Increment 1 — the foundation.** Brand Memory, the Model Router, and
> Settings are fully working. The 6-step pipeline (Topic → Brief/Draft → Visuals
> → Compliance → Package → Persona Lab) ships in later increments; each step has
> a roadmap placeholder today.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

The app works **fully in demo mode with zero setup** — preloaded synthetic
Capital One data and seeded model responses. To go **live**, open **Settings**
and add your LLM Foundry gateway.

## Connecting models (LLM Foundry)

Settings → **Gateway connection**:

- **Gateway base URL** — OpenAI-compatible, e.g. `https://llmfoundry.straive.com/openai/v1`
- **API key** — stored only in your browser (opt-in persistence)
- **Model assignments** — per role:
  - **Text & reasoning** (Claude class) — strategy, briefs, copy, compliance, personas
  - **Image** (Gemini "Nano Banana") — on-brand visual generation
  - **Vision** (optional) — reads uploaded creative; defaults to the text model
- Each role has a **Test** button that pings the gateway and reports latency / errors.

Every model call is routed through one adapter and logged in the always-on
**Model Router** console (step, model, why-this-model, latency, tokens/assets,
live/demo badge).

## What's in Increment 1

- **Brand Memory** — ingest collateral (upload / paste copy / paste URL), analyze
  copy via the reasoning model and visuals via vision, and re-derive an editable
  **Brand Profile** (voice, messaging, visual identity, compliance fingerprint).
- **Model Router** — the visible "right model for the right job" console.
- **Settings** — gateway + per-role models + connectivity tests.
- **Export everywhere** — JSON / Markdown on the profile, repository, and router log.

## Architecture

```
src/
  lib/router/   model-routing layer (gateway, roles, router, tests)
  lib/brand/    brand-grounding layer (grounding, profile, analyze, derive)
  lib/          export, format, json, file, cn helpers
  store/        Zustand store (localStorage persistence; keys opt-in)
  seed/         synthetic Capital One data (assets, profile, rulebook, backlog, segments)
  components/   design system (Button, Card, Badge, Tabs, Modal, Field, ScoreGauge, …)
  views/        AppShell, Overview, Brand Memory, Brand Profile, Settings, Model Router
```

## Guardrails (first-class, by design)

- Compliance output is **decision support, not legal advice** — a human signs off.
- Synthetic audience results are **directional signal, not ground truth**.
- Brand data is **illustrative / public-derived**, a style reference only.
- Segments are behavioral / needs-based — **never protected classes or proxies** (Reg B / ECOA).
- All data and API keys stay **in app state** (browser only); nothing is stored externally.
