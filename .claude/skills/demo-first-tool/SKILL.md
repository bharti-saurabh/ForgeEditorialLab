---
name: demo-first-tool
description: Use when building a new client-side, demo-first AI tool in the Forge/Straive style — Vite + React + TS + Tailwind + Zustand, zero-key demo fallbacks, compliance/fairness guardrails, and a consistent master-detail UI. Encodes the conventions and pitfalls learned building Forge (Editorial Lab). Trigger it for greenfield "single-purpose AI web tool" builds, or when extending one.
---

# Building a demo-first AI tool (the Forge playbook)

A prescriptive checklist distilled from building Forge. Follow it to produce a
polished, single-purpose AI web tool that works with zero keys, stays honest, and
feels like one coherent product. Pair with `learnings.md` (the "why").

## Stack & non-negotiables
- **Vite + React 18 + TypeScript + Tailwind + Zustand** (persist → localStorage).
  Hand-built components; no heavy UI kit.
- TS strict: `noUnusedLocals` + `noUnusedParameters` ON.
- **Build after every change:** `tsc -b && vite build`. Fix while context is fresh.
- Keep heavy deps (charts, PDF) behind `lazy()` so they tree-shake out of the main
  bundle.

## The demo-first pattern (do this first, it's the backbone)
Every AI/external call goes through one wrapper that serves a deterministic seeded
fallback when no gateway/key is configured:

```ts
runChat({ system, user, demo }): { text, mode: 'live' | 'demo' }
// live when a gateway URL + key are set for the role; otherwise returns demo()
```

- Put each prompt and its `demo…()` generator in the **same file** (`prompts/*.ts`).
- Demo generators are deterministic (hash a seed string; NO `Math.random`/`Date.now`
  in the generator). The app must show a full, coherent result on first load.
- Header shows a **Demo / Live** chip. Keys are opt-in localStorage; the committed
  default key is empty.
- **Coerce model JSON against the demo base:** `coerceX(base, parsed)` overlays only
  valid (enum-checked, non-empty) fields. One path for live + demo; malformed output
  degrades to the base.

## State & persistence discipline
- Zustand + `persist`, a single versioned key. On load, spread defaults over the
  persisted state so new **top-level** fields backfill.
- **Nested snapshots do NOT backfill.** When you change a nested object's schema,
  **bump the persist version** and drop the stale nested object in a merge helper
  (`if (!obj.newRequiredField) obj = null`). The user just re-runs that step.
- **Never persist heavy payloads.** Strip base64/`data:` URLs in `partialize`; wrap
  storage to swallow `QuotaExceededError`. (A storage error otherwise masquerades as
  an API failure.)

## UI philosophy
- One layout language across the whole tool: **setup/summary on top → master-detail
  (selectable list ↔ wide detail) → finalized artifacts below.** `max-w` container,
  sticky left list, `grid-cols-[minmax(...)_1fr]`.
- Everything the human owns is **editable** (buffered edit + Save/Revert + a dirty
  indicator). Parity across steps — don't leave one stage read-only.
- All hooks before any early `return`.

## If it's a review / score / validate feature — READ THIS
- **Validate the real artifact, not a proxy.** Litmus test: edit the actual content;
  if the output doesn't change, the feature is disconnected. Feed it the real
  text/image/inputs.
- **Gates are resolvable, not informational.** Every flag gets resolve / override /
  edit with an accountable actor. Block the "export/ship" action until clear.
- **Carry context forward.** "Send back" must carry *what to fix* into the next step.
- **Don't fake precision on synthetic data.** Confidence bands, "n=k synthetic"
  labels, resample on re-run. Label all synthetic output as directional.

## Guardrails (bake in from step 1)
- **Fairness:** any audience/segment is behavioral / needs-based only — NEVER
  protected classes or proxies (age, race, sex, marital status, ZIP…). Enforce in
  BOTH a screening function AND the generation system prompts. Use **word-boundary
  regex** (`\b…\b`), not substring blocklists (which flag "management"/"manage").
- **Regulated-honesty:** don't invent figures; keep bracketed placeholders
  (`[APR]`, `[fee]`, `[term]`) through every transform; add real numbers only at an
  explicit gate.
- **Decision-support, not authority:** AI flags + cites; a named human signs off. AI
  never auto-approves.
- **Only scan published content** for compliance — never internal prompts/metadata
  (that raises phantom findings).
- **Transparency:** if the tool calls anything beyond the LLM gateway, say so in the
  UI and make it opt-in/configurable (don't hardcode third-party services).

## Design system (Straive aerospace)
- Navy chrome + **accent orange #FF5000**; neutral ink greys; ok/warn/crit/info
  semantics. Rounded cards, soft shadows, glass on a dark header. Confident, not
  playful. Tailwind tokens for the palette. Small uppercase-tracked section labels;
  tabular numbers.

## Platform reality (design within it)
- Static hosting (GitHub Pages) = no server → no arbitrary web fetching (CORS), no
  secrets, no jobs. To read external URLs, use a **CORS-enabled reader API from the
  browser** (e.g. r.jina.ai) with a **paste fallback** — or deliberately add a
  backend. Deploy gotcha: Pages **Source = "GitHub Actions."**

## Process
1. Critique / clarify scope with 1–3 focused questions.
2. Propose a **phased plan**; build **phase by phase with a build check each phase.**
3. Be honest about constraints — propose the version that actually works over the
   one that silently breaks a promise.

## Top pitfalls to avoid
Proxy-not-artifact validation · persisting blobs (quota) · nested-schema change with
no version bump/stale-drop · substring guardrails · false precision on synthetic data
· informational-only checks · scanning internal text for compliance · assuming a
static site can fetch the web.
