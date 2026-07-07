# Forge (Editorial Lab) — Progress, Approach & Learnings

> Living handoff doc. Purpose: survive context compaction. If you're resuming
> cold, read this top-to-bottom first. Last updated after **Persona Lab was
> redesigned into a live agentic focus group — Phases 1, 2 + 3 all built (§14).**
> ⚠️ §13 (the survey/metrics rework) is now SUPERSEDED by §14 — the survey
> engine was torn out. Prior milestones: Step-5 rework (§12), Step-4 rework.

---

## 1. What this project is

**Forge (Editorial Lab)** — a **pure client-side** React app: a compliance-first,
multi-model AI **content marketing engine** for a *synthetic* Capital-One-style
brand (a regulated U.S. card issuer). It walks a marketer through a 6-step
pipeline from topic → published, channel-ready package, with a bank-grade
compliance gate and human sign-off in the middle. All data/AI is illustrative;
nothing is real client data.

- **Repo:** https://github.com/bharti-saurabh/ForgeEditorialLab (branch `main`)
- **Live site:** https://bharti-saurabh.github.io/ForgeEditorialLab/ (GitHub Pages)
- **Deploy:** push to `main` → `.github/workflows/deploy.yml` builds & deploys.
  Vite `base` is `/` in dev, `/ForgeEditorialLab/` in build.

### Stack
Vite + React 18 + TypeScript + Tailwind CSS + Zustand (persist → localStorage) +
Recharts. No backend. `gh` CLI is **not installed** on this machine — use git
push to deploy; use `git`/curl for GitHub, not `gh`.

### TypeScript strictness (bites often)
`noUnusedLocals` **and** `noUnusedParameters` are **on** (tsconfig.app.json,
tsconfig.node.json). Every unused import/param/local fails the build. Drop them.

---

## 2. STANDING GUARDRAILS (never violate)

- **"Keep all data, uploads, and API keys in app state; store nothing externally."**
  API key is browser-only, opt-in localStorage persistence (`settings.persistKey`);
  the committed default `apiKey` must be empty.
- **Compliance = decision support, NOT legal advice.** Human-in-the-loop sign-off
  is mandatory. AI never auto-approves.
- **Synthetic audience (Persona Lab) = directional signal**, labeled as such.
- **Segments must be behavioral/needs-based — NEVER protected classes or
  Reg B/ECOA proxies.**
- **No external calls** beyond the user-configured LLM gateway. (This is why the
  "real-time competitor feed" is a *simulated* animated feed, and why generated
  images are deterministic SVG mocks in demo mode.)
- Placeholders like `[APR]`, `[balance-transfer fee]`, `[term]` are preserved
  through every transform; approved figures are only added at the compliance gate.

---

## 3. The 6-step pipeline (views)

| Step | View | Purpose |
|---|---|---|
| 1 | `TopicIntelligenceView` | Rank a topic backlog; take one forward. Master-detail: backlog left, detail right; priority "lenses" + weight sliders re-rank live; **simulated** live competitor feed; AI editorial read + competitor watch as top buttons/modals. |
| 2 | `BriefDraftView` | Topic → content brief → on-brand draft, multi-model **bake-off**. Now master-detail + explicit Save. |
| 3 | `VisualAssetsView` | Channel-derived visuals; per-slot **image variant bake-off** (pick one); vision safety + caption/alt checks. |
| 4 | `ComplianceView` | Rule-cited gate + AI net-impression assessment + human sign-off + audit trail. Reworked: reconnected, channel-aware, master-detail. |
| 5 | `PublishView` | **NEXT TO REWORK.** Adapt approved copy per channel + re-check + export. |
| 6 | `PersonaLabView` | Synthetic focus-group validation. (Recharts lives ONLY in this lazy chunk — keep it that way.) |

---

## 4. Core architecture / conventions

### Model router (demo-first) — `src/lib/router/router.ts`
- `runChat({role, step, system, user|messages, reason, maxTokens, demo, modelId?})`
  → `{text, mode: 'live'|'demo', entry: RouterLogEntry}`. **Live** when a gateway
  URL + API key are set for the role; otherwise serves the seeded `demo()`.
- `runImage({..., size?, modelId?})` → `{url, mode, entry}`. **`modelId` override
  added this session** (for the Step-3 image bake-off).
- `runVision({step, text, imageUrl, system?, demo})` → same shape (used for the
  Step-3 vision safety read).
- `logEntry()` calls `useAppStore.getState().addRouterLog(entry)` — i.e. every
  model call triggers a Zustand `set()` (this caused the storage bug below).

### Store — `src/store/useAppStore.ts`
- Zustand + `persist`, key **`forge-state-v1`**, version 3.
- `migrate` and `merge` both spread `{ ...EMPTY_PIPELINE, ...(persisted.pipeline ?? {}) }`
  → **any new `PipelineState` field auto-backfills** on reload. When you add a
  pipeline field, also add it to `EMPTY_PIPELINE`, the `selectTopic` reset block,
  and `src/seed/completedRunBuild.ts` (the "Load example run" literal).
- **`partialize`** strips base64 image payloads before persisting (see §5).
- **`safeStorage`** wraps localStorage; swallows `QuotaExceededError` (see §5).

### Channels — `src/lib/channels.ts` (added this session, single source of truth)
- `ChannelKey = 'blog' | 'linkedin' | 'email' | 'paid-social' | 'sem'`.
- `CHANNEL_SPECS: Record<ChannelKey, ChannelSpec>` — label, `kind` (`image` |
  `text-ad`), aspect `ratios` (+ image-gen `size`), `briefGuidance`, `draftForm`,
  `lengthTarget`, `preview` chrome key (`article`|`feed`|`serp`|`inbox`).
- `PRIMARY_CHANNELS = ['blog','paid-social','sem','email']` (the Step-2 picker set).
- `channelSpec(key)`, `isImageChannel(key)`, `channelForFormat(topicFormat)`.
- NOTE two "channel" concepts coexist: **`CHANNEL_SPECS`** (authoring behavior)
  and **`src/lib/publish.ts` `CHANNELS`/`ChannelMeta`** (the Publish fan-out +
  `recheckChannel`, with `charLimit`, `allowsLinkedDisclosure`). Keep them in sync.

### Master-detail UI philosophy (Steps 1–4, apply to 5 next)
- Container `max-w-7xl`. Setup/summary zone full-width on top.
- Grid `lg:grid-cols-[minmax(...px,...px)_1fr]`, `items-start`; left column wrapped
  in a `lg:sticky lg:top-4` div; a selectable list on the left drives a wide detail
  panel on the right; finalization artifacts below full-width.
- Tailwind tokens: `navy` (50–950), `straive` (orange #ff5000, 50–950), `ink`
  (neutrals), `ok`/`warn`/`crit`/`info`. Brand: see `BRAND.md`.

### Rules of hooks
All `useMemo/useState/useEffect` must precede any early `return` (e.g.
`if (!topic) return …`). New memos go before the guard, with null-safe bodies.

---

## 5. The localStorage quota bug (fixed) — important context

**Symptom:** a successful model call showed `Live call failed (Failed to execute
'setItem' … exceeded the quota); served seeded response` in the Model Router.

**Root cause:** `logEntry()` → `addRouterLog` → `set()` writes the whole persisted
state to localStorage **synchronously inside the live-call `try` block**. Generated
images are stored as base64 data-URLs inside `visuals[].url` (and brand assets in
`brandRepo[].imageUrl`), so the state blew past the ~5 MB cap; `setItem` threw
`QuotaExceededError`, which the fallback `catch` mislabeled as a live-call failure.

**Fix (in `useAppStore.ts`):**
1. **`partialize`** strips `data:` URLs — `visuals[].url` → `''`, `brandRepo[].imageUrl`
   → `undefined` — before persisting. Metadata/captions/prompts kept; only pixels dropped.
2. **`safeStorage`** (`createJSONStorage(() => safeStorage)`) swallows quota/private-mode
   failures, keeps the last good copy, warns once via a toast (off the current `set()`).
3. Graceful placeholders where images may be empty after reload
   (`VisualAssetsView` VariantCard, `PublishView` hero, `PostPreview`).

**Consequence to remember:** generated images do **not** survive reload (by design).
Anything that shows an image must handle empty `url`. Don't try to persist images.

---

## 6. Everything done THIS SESSION (chronological)

### A. Storage-quota fix
See §5. Also fixed the mislabeled router error at its source (storage no longer throws into the call path).

### B. Channel-native pipeline (Phases 1–4)
Make the **publish channel a first-class, upstream decision** that shapes the whole pipeline.
- **P1 (foundation):** `ChannelKey` gained `'sem'`; `pipeline.primaryChannel` (required, backfilled); `channels.ts`; store `setPrimaryChannel` (seeded from `topic.format` on `selectTopic`); Step-2 **Publish channel picker**; read-only `ChannelChip` echoed in Steps 3/4/5.
- **P2 (brief+draft):** `buildBriefPrompt/demoBrief` and `buildDraftPrompt/demoDraft` take the channel and reshape output — blog (article), paid-social (short caption), **SEM (3 headlines ≤30 + 2 descriptions ≤90)**, email (subject/preheader/body). All keep placeholder + disclosure discipline; vary by model for the bake-off.
- **P3 (visuals + preview):** `suggestedSlots(channel)` derives ratios; **SEM is text-only** (no image generator). New **`PostPreview`** component (`src/components/PostPreview.tsx`) renders real chrome: `article` (blog), `feed` (paid-social card), `serp` (Google result — parses the Headlines/Descriptions lists), `inbox` (email). Rendered in **Step 3** after generation and at the **top of Step 4** (net-impression on the rendered artifact).
- **P4 (publish reconcile):** SEM added to `publish.ts CHANNELS` + `demoAdaptation` SEM case; **primary channel sorted first + "Primary" badge**; `PostPreview` reused in the package summary.

### C. Step-3 gaps #1–#3
- **#1 Real image safety:** `SAFETY_VISION_SYSTEM` + `buildSafetyVisionPrompt` in `prompts/visual.ts`; a **live** image gets a `runVision` read of the actual pixels; demo/SVG-mock falls back to the deterministic `assessBrandSafety` heuristic. Card labels source ("vision read" vs "Text heuristic"). Types: `VisualAsset.safetyModelLabel?/safetyMode?/edited?`.
- **#2 Editable caption + alt:** inline edit → `updateVisual`, marks `edited`.
- **#3 Compliance/accessibility:** `VisualChecks` panel = image brand-safety + **caption compliance** (`scanText`, preview of the Step-4 engine) + **alt-text a11y** (`assessAltText`).

### D. Steps 2 & 3 master-detail redesign + Step-2 Save + Step-3 variant bake-off
- **Step 2:** Publish channel (narrow) + Content brief (wide) side by side on top, **aligned to the same grid template** as the bake-off list (left) + finalize editor (right) below (`lg:grid-cols-[minmax(320px,360px)_1fr]`). Brief is collapsible (auto-collapses once drafts exist). **`DraftEditor` rewritten**: buffered edits, **explicit Save + Revert**, "Unsaved changes" indicator, live metrics + compliance preview, Edit/Preview toggle. `DraftCard` → compact selectable `DraftRow`.
- **Step 3:** master-detail — slots left, per-slot **image variant bake-off** right. Generate across models/seeds (`runImage` `modelId` + `IMAGE_BAKEOFF = ['gemini-2.5-flash-image','gpt-image-1','dall-e-3']`); **candidates live in memory only**, only the **selected** visual persists (keeps the quota fix intact). `VisualAsset.costUsd?` added. SEM short-circuits to text-only + preview.

### E. Step-4 (Compliance) full rework
- **Phase 1 — reconnection:**
  - **`applyCleanToDraft(actor)`** (store) writes the clean version (accepted rewrites + appended disclosures) back onto the chosen draft (re-scores brand-match, marks `edited`). UI button **"Apply fixes to draft."** Intentionally does **not** re-stamp the signature → the write-back marks the review **stale** → forces re-run → clean → sign off.
  - **Stale sign-off (#6):** `ComplianceState.reviewedSig` = `contentSignature(draft, visuals)` (djb2 hash of title+body + each visual id/caption/alt/safety-status; ignores heavy/stripped url). A later edit ⇒ stale banner, "Stale — re-run" badge, **sign-off disabled**, and **Publish blocked** (`PublishView` `stale`).
  - **Carry Step-3 findings (#3):** flagged visual keeps its real vision notes + model; **alt-text a11y** (WCAG 2.2 §1.1.1) becomes a Minor finding.
  - **Channel-aware gate (#4):** `analyzeContent`/`buildChecklist` take `{ allowLinkedDisclosure }` (from `channelMeta(primaryChannel)`); on short-form channels a "see terms" link satisfies a non-inline disclosure (`DisclosureCheck.linked`). Legal lines stay inline-only.
  - **Layout:** top summary (PostPreview + scoreboard); master-detail **worklist** (findings + disclosure rows) → right detail (resolve actions / disclosure / assessment); below: redline & clean, sign-off, audit.
- **Phase 2 — rigor:**
  - **#5 Explainable score:** `explainScore(state)` → line-item breakdown; "Why this score?" toggle. Exported `SEVERITY_PENALTY` / `MISSING_DISCLOSURE_PENALTY` / `MISSING_LEGAL_LINE_PENALTY`.
  - **#9 Human-added findings:** `addComplianceIssue(issue, actor)` (store); "+ Add" → `AddFindingForm` in the right panel; `ComplianceIssue.manual?` + "Manual" badge.
  - **#7+#8 Net-impression review (merged):** `netImpressionChecks(draft, visuals)` → prompts under the PostPreview; reviewer marks Pass/Flag; **Flag promotes to a first-class manual finding**.

### F. Compliance image-prompt-scan bug (fixed)
`analyzeContent` scanned each visual's `caption + altText + **prompt**`. The auto
image prompt contains negated art-direction ("no depiction of **guaranteed**
wealth…") and the headline (e.g. "balance transfer"), so the substring rule
engine raised **phantom Critical** findings (`rule_guaranteed`,
`rule_apr_disclosure`) tagged to the visual, with snippets absent from the post.
**Fix:** scan only **caption + alt** (published text); the rendered image's
net-impression risk is already the vision read's job. Finding **rows now show the
flagged snippet** so the source is unmistakable. *Users must **Re-run** the gate
for the fix to take effect on an existing compliance result.*

---

## 7. Commits this session (newest first)
```
ed970cf  Fix: compliance gate no longer scans the internal image prompt
62444cd  Master-detail Steps 2-3 + full Step-4 (compliance) rework
2cfd8ee  Step 3: real image safety read, caption/alt compliance, editable text
df82aeb  Channel-native pipeline, editorial-desk upgrades, and storage-quota fix
```
(Prior baseline: `6966040` nav redesign, `76ca75f` Pages workflow, `9e476f6` initial.)

---

## 8. DEPLOYMENT — known issue (needs a repo setting)

Pages deploys have been failing. **Build side verified clean locally:**
`package-lock.json` is committed & in sync (`npm ci` OK); all `@/…` imports
resolve with exact casing (no macOS-passes/Linux-fails trap); no gitignored-but-
imported assets; `npm run build` passes. So the failure is on the **deploy job /
Pages config**, which can't be changed from this machine (`gh` not installed,
unauthenticated GitHub API is rate-limited).

**Fix the user must do once:** Repo → **Settings → Pages → Build and deployment →
Source → "GitHub Actions"** (not "Deploy from a branch"). Then re-push or
Actions → "Deploy to GitHub Pages" → Re-run all jobs. If it still fails, read the
failed run: which job is red (**build** vs **deploy**) + the red step text.

---

## 9. Key files (map)

- `src/types.ts` — all domain types. Recently added: `ChannelKey 'sem'`,
  `PipelineState.primaryChannel`, `BriefInput`, `DraftVariant.usage/edited`,
  `VisualAsset.safetyModelLabel/safetyMode/edited/costUsd`,
  `DisclosureCheck.linked`, `ComplianceState.reviewedSig`, `ComplianceIssue.manual`.
- `src/store/useAppStore.ts` — store, persist, `safeStorage`, `partialize`,
  channel/brief/draft/visual/compliance actions incl. `setPrimaryChannel`,
  `updateBrief`, `updateDraft`, `applyCleanToDraft`, `addComplianceIssue`.
- `src/lib/channels.ts` — `CHANNEL_SPECS` (authoring behavior).
- `src/lib/publish.ts` — `CHANNELS`/`ChannelMeta`, `recheckChannel` (Publish fan-out).
- `src/lib/complianceEngine.ts` — `scanText`, `buildChecklist`, `analyzeContent`,
  `computeScore`/`currentScore`, `buildCleanVersion`, `contentSignature`,
  `explainScore`, `netImpressionChecks`, exported penalty consts.
- `src/lib/prompts/{draft,visual,compliance,publish}.ts` — prompts + zero-key demos.
- `src/lib/router/{router,roles,gateway,pricing}.ts` — routing + `estimateCostUsd`/`fmtUsd`.
- `src/components/PostPreview.tsx` — channel chrome (article/feed/serp/inbox).
- `src/components/ChannelChip.tsx` — read-only channel chip.
- `src/lib/draftCompliance.ts` — per-draft compliance preview (Step 2 bake-off).
- `src/seed/*` — rulebook, topic backlog, brand profile/assets, segments,
  competitorMoves, `completedRunBuild.ts` (the "Load example run" literal).

---

## 10. NEXT: Step 5 (Publish Package) — critique + proposed plan (NOT yet built)

**Purpose:** approved master copy + hero + sign-off → channel-ready package;
adapt per channel + per-channel re-check + export (JSON/MD/print).

**What's missing (ranked):**
1. **Re-adapts the primary channel from scratch — discards native work.**
   `assemble()` loops **all** `CHANNELS` incl. the primary and re-derives from the
   blog-style `masterCopy` via `demoAdaptation`. The channel the piece was
   authored, edited, and signed-off *for* gets thrown away. → The primary
   channel's package entry should **be the approved draft**, not a re-adaptation.
2. **Per-channel re-check is informational, not a gate.** `recheckChannel` flags
   reintroduced triggers / missing disclosures / char overflow as notes you
   **can't resolve**; `PublishPackage.complianceScore` is the *master's* score.
   An adaptation can drop a disclosure and still export → compliance hole.
3. **Adapted copy isn't editable** (generate/regenerate only) — breaks the
   human-in-the-loop parity the rest of the app now has.
4. **No per-channel visuals.** Step 3 makes channel-specific ratios, but the
   package carries ONE hero thumbnail; channel cards are text-only.
5. **It's a document, not a handoff.** No schedule/owner/UTM/status per channel,
   no copy-for-CMS affordances.
6. **SEM is packaged wrong** — rendered as one `<pre>` blob with a single 300-char
   budget instead of structured 3×≤30 headlines + 2×≤90 descriptions per-field.
7. **No staleness signal on an assembled package** (snapshots `masterCopy`; can
   silently diverge after later edits; only a manual "Re-assemble").

**Proposed phasing (keep master-detail: channel list ↔ channel detail/editor):**
- **Phase 1 — reconnection + per-channel gate:** #1 (primary = approved draft),
  #2 (make the re-check an actual gate: resolve/override + per-channel status that
  blocks export), #3 (editable adaptations).
- **Phase 2 — real handoff:** #4 (per-channel visuals), #5 (schedule/UTM/metadata),
  #6 (structured SEM with per-field limits).

**User's stated intent:** wants Step 5 examined next; asked for this doc BEFORE
building. Awaiting go-ahead on the plan (and whether to fold in the master-detail
layout pass, consistent with Steps 1–4).

> **STATUS: BUILT.** Phases 1 + 2 are done — see §12. This §10 is kept as the
> original critique/plan for reference.

---

## 12. Step 5 (Publish Package) — Phase 1 + 2 rework (BUILT)

Converted `PublishView` to the **master-detail** philosophy (channel list ↔
channel detail/editor) and closed all seven gaps from §10.

### Types (`src/types.ts`)
- `ChannelResolution { overridden; by; note; at }` — human override that clears a
  channel's re-check for export.
- `SemAsset { headlines[]; descriptions[] }` — structured responsive search ad.
- `ChannelHandoff { status; scheduledFor; owner; utmSource; utmMedium; utmCampaign }`
  + `HandoffStatus = 'draft'|'scheduled'|'published'`.
- `ChannelAdaptation` gained (all optional, backfill-safe): `isPrimary`, `edited`,
  `resolution`, `sem`, `visualId`, `handoff`.

### `src/lib/publish.ts`
- `SEM_LIMITS` (headline ≤30, description ≤90, 3 headlines, 2 descriptions).
- `defaultHandoff(channel, topic)` — sensible per-channel utm_source/medium +
  a campaign slug from the topic title.
- `utmQuery(handoff)` — builds the `?utm_source=…&utm_medium=…&utm_campaign=…` string.

### `src/lib/prompts/publish.ts`
- `AdaptationDraft` gained optional `headlines?`/`descriptions?`.
- SEM demo now returns **structured** headlines/descriptions (+ still composes the
  `body` blob for the SERP preview via `composeSemBody`).
- `composeSemBody(h,d)` / `parseSemBody(body)` round-trip structured ⇄ list body.

### `src/views/PublishView.tsx` (full rewrite, master-detail)
- **#1 primary = approved draft:** `assemble()` builds the primary channel's entry
  from the **approved draft itself** (`primaryAdaptationDraft()` → draft.title +
  `masterCopy`; SEM primary parses structured fields out of the draft). Only the
  non-primary channels call the copy model (`adaptModel`). Primary entry is
  **read-only** in the UI (edit upstream in Step 2 to keep sign-off valid).
- **#2 per-channel gate:** `isClear(c)` = re-check `pass` OR `resolution.overridden`.
  Export is **blocked** (ExportButton swapped for a disabled "Export blocked · N to
  clear" button) until every channel is clear. `RecheckPanel` offers a **reviewer
  override** (name + rationale → `resolution`, timestamped) or "Undo". Summary shows
  "Channels clear X/N" + "Export Ready/Blocked".
- **#3 editable adaptations:** `ChannelEditor` (buffered, Save/Revert, "Unsaved
  changes", `edited` badge) edits headline/body/cta/hashtags; **SEM uses
  `LimitedList`** with per-field char counts + over-limit highlight. Every edit
  re-runs the gate via `finalizeChannel` (recompute recheck + charCount).
- **#4 per-channel visuals:** `VisualPanel` assigns any Step-3 visual per channel
  (`visualId`, hero default; SEM = text-only). Thumbnail handles empty url (quota fix).
- **#5 real handoff:** `HandoffPanel` — status / go-live date / owner / UTM fields,
  **Copy UTM** + **Copy for CMS** clipboard actions.
- **#6 structured SEM:** stored + edited + exported as headlines[]/descriptions[]
  with Google Ads limits, not a `<pre>` blob.
- Master-detail: summary (full width) → `lg:grid-cols-[minmax(280px,320px)_1fr]`
  sticky channel list (status dot, primary/edited badges, char/field counts) ↔
  `ChannelDetail` (PostPreview + editor + RecheckPanel + VisualPanel + HandoffPanel).
- Markdown export (`buildPackageMarkdown`) now includes primary flag, structured
  SEM, override status, and handoff/UTM per channel.

### Seed (`src/seed/completedRunBuild.ts`)
- The "Load example run" package now sets `isPrimary` (blog), structured SEM,
  `visualId` (hero for image channels), and `defaultHandoff` per channel — so the
  example opens already demonstrating the new fields.

**Build:** `npm run build` clean; Recharts still isolated to the PersonaLabView chunk.
**Not yet committed** at time of writing.

---

## 13. Step 6 (Persona Lab) — Phase 1 + 2 rework (BUILT)

**Critique:** the panel never read the artifact. `simulateSurvey`/`simulateComment`/
the synthesis prompt consumed only two scalars (brandMatch, complianceScore) + the
topic title + a per-segment hash — so editing copy/visual/CTA moved nothing. Also
channel-blind, false precision (n=3–10 shown as exact integers, deterministic re-run),
templated quotes, no variant compare, revisions carried nothing, crude substring
fairness screen, flat unweighted overall.

**Decision:** Phase 1 + 2, and **Re-run resamples** (fresh seed each run).

### Phase 1 — ground the panel in the real artifact
- **`analyzeDraftForPersona(draft, channel, profile, hasVisual)` → `ContentSignal`**
  (`persona.ts`): readability (sentence length + long-word ratio), CTA-presence,
  channel-fit (body words vs per-channel band `CHANNEL_WORDS`), reassurance cues,
  and `objectionCoverage(objections)` — how well the copy engages+answers a
  segment's stated objections.
- **`simulateSurvey` rewritten** to consume the signal + a per-run `seed`:
  Clarity←readability, Trust←compliance+objectionCoverage, Appeal←alignment+
  channelFit+visual, Intent←appeal/trust+**CTA present**+channelFit+funnel. Editing
  the copy now moves scores.
- **`simulateComment`** grounds each quote in a real line (`signal.leadLine`); a
  positive voice no longer shows an objection.
- **Synthesis prompt** (`prompts/persona.ts`) now includes the headline + a 700-char
  copy excerpt + the surface, and asks the model to react to the actual wording.

### Phase 2 — rigor + handoff
- **Resample:** each run uses `seed = Date.now() % 1e6` (seeded example run uses a
  fixed `424242`). `PersonaLabState` gained `runSeed`, `channel`.
- **Confidence, not false precision:** `confidenceBand(n)` → `PanelConfidence {n,band,
  level}`; metric tiles show `±band`, a "low/moderate confidence · n=k synthetic" chip.
- **Weighted overall:** `overallScore` now weights intent .35 / trust .30 / appeal .20 /
  clarity .15 (`OVERALL_WEIGHTS` exported; weights shown on the tiles).
- **A/B compare:** `scoreVariant` + `buildComparison` score the chosen draft vs the
  strongest Step-2 bake-off runner-up on the same panel/seed → `PersonaComparison`
  (winner/delta), rendered as a two-column card. Null when there's no runner-up.
- **Revision handoff:** `revisionAsk(state)` builds "lift <weakest metric>; weak with
  <segments>; recurring objections <…>" and `requestRevisions` writes it to the new
  `PipelineState.revisionNote`; **Step 2 shows a dismissible banner** (`clearRevisionNote`).
- **Master-detail** per-segment drill-down (segment list ↔ metrics bars + quote +
  motivations/objections), replacing the flat comment list. Kept the two aggregate charts.
- **Hardened fairness:** `checkFairness` now uses word-boundary regexes per protected
  basis (+ veteran status, more proxies) — kills the `'men '`/`'age '` substring hacks
  and their false-positives (e.g. "management").

### Store / migration
- `PipelineState.revisionNote` added (EMPTY_PIPELINE, selectTopic reset, seed).
- **persist bumped to v4** + new `mergePipeline()` used by migrate & merge: drops a
  persona snapshot saved before this change (no `confidence`) so the new UI never
  reads a half-populated object — user just re-runs the panel.

**Build:** clean; Recharts still isolated to the PersonaLabView lazy chunk.

---

## 14. Persona Lab → live agentic focus group (Phases 1 + 2 BUILT; Phase 3 pending)

**User's new vision (replaces the survey model in §13):** (1) user picks which
behavioral segments + how many participants; (2) an LLM generates detailed
individual personas; (3) a **moderator agent** runs a **live, streamed** focus
group where each participant reacts in turn; (4) summary + light stats; (5) a set
of **selectable** recommendations that revamp the content. Confirmed choices:
**qual + light end-stats** (dropped the 4-metric survey/gauge + A/B), **stream
turn-by-turn**, recommendations **both carry to Step 2 AND draft revised copy inline**.

### Data model (types.ts — PersonaLabState fully redefined)
- Removed: FocusComment, SurveyRow, SurveyMetric, PersonaRecommendation,
  PanelConfidence, VariantScore, PersonaComparison.
- Added: `FocusGroupConfig`, `Participant` (name, segment, archetype, personality,
  likes/dislikes/interests/goals/frustrations, bio, voice, avatarSeed), `AgendaItem`,
  `DiscussionTurn` (moderator|participant, sentiment), `ThemeStat`, `FocusGroupStats`,
  `ContentRecommendation`, `RevisedDraft`, `FocusGroupStage = personas|discussion|complete`.
- `PersonaLabState` now: `{ runAt, channel, stage, config, participants, agenda,
  transcript, summary, stats, recommendations, selectedRecIds, revisedDraft,
  moderatorModelLabel, mode, fairnessNote, fairnessFlags }`.

### New / changed modules
- **`src/lib/persona.ts`** trimmed to shared helpers: `LENS_ORDER`,
  `PARTICIPANT_MIN/MAX` (3–8), `SEGMENT_MIN`, `FAIRNESS_NOTE`, `hashStr/unit/pick`,
  `defaultPanel`, `SENTIMENT_TONE`, hardened `checkFairness` (word-boundary regex).
- **`src/lib/focusGroup.ts`** (NEW): `demoParticipants`/`coerceParticipant`
  (deterministic, neutral names), `distributeSegments`, `buildAgenda` (5 beats:
  first impressions→clarity/trust→offer&CTA→objections→would-you-act),
  `moderatorOpening`, `demoDiscussionTurns`/`coerceTurns` (per-beat, sentiment-tagged).
- **`src/lib/prompts/persona.ts`** rewritten: `PERSONA_GEN_SYSTEM` +
  `buildPersonaGenPrompt` (Phase 1), `DISCUSSION_SYSTEM` + `buildDiscussionPrompt`
  (Phase 2). **Fairness enforced in the system prompts** (behavioral only; names are
  flavor, never a demographic basis).
- **`PersonaLabView.tsx`** rewritten to 3 UI steps: **SetupCard** (segment picker +
  participant stepper + custom-segment add, fairness-screened) → **Roster**
  (participant cards + agenda preview + "Start the discussion") → **Discussion**
  (moderator opening, then per-beat turns **streamed** via an async loop with
  `sleep()` reveal + typing indicator; Stop/Re-run; "New group"). Avatars = initials
  + 6-slot palette. Export = transcript md/json.

### Router / demo path
- Persona gen + each agenda beat call `runChat({role:'strategy'})`; both have full
  deterministic demo fallbacks so the whole group runs with **zero keys**. Streaming
  = generate per beat, reveal turns with a timer (works live + demo).

### Store / seed / persist
- `PipelineState` unchanged here; **persist bumped to v5**; `mergePipeline` now drops
  a persona lacking `stage` (old survey shape) so the new UI can't read it.
- Seed "Load example run" builds a **stage:'personas'** roster (config + participants
  + agenda) — opens with a ready focus group. (Enrich to a full `complete` run when
  Phase 3 lands.)
- **Recharts is now fully tree-shaken** (Persona Lab was its only consumer). Phase 3
  re-introduces it for the stats charts — keep it isolated to the PersonaLabView chunk.

### Phase 3 — wrap-up, recommendations, inline revise (BUILT)
- **`focusGroup.ts`**: `computeStats(transcript, participants)` → `FocusGroupStats`
  (sentiment split, theme frequency from shared frustrations/goals, standout quotes,
  `resonance` strong|mixed|weak from net sentiment); `demoSummary`, `demoRecommendations`
  (concern-keyword → fix templates), `demoRevise` (inserts a plain-terms clarity block,
  keeps disclosures + `[APR]`/`[term]` placeholders).
- **`prompts/persona.ts`**: `SUMMARY_SYSTEM`/`buildSummaryPrompt` (returns
  `{summary, recommendations[]}`), `REVISE_SYSTEM`/`buildRevisePrompt` (returns
  `{title, body}`; forbids dropping disclosures or inventing figures).
- **View**: after the discussion, a **"Summarize & get recommendations"** card →
  `wrapUp()` sets `stage:'complete'` with stats/summary/recs. Then a **Results** block:
  summary card, stats card (CSS sentiment bars + theme chips + standout quotes +
  resonance badge — **no recharts**), and a **selectable recommendations** list
  (checkboxes → `selectedRecIds`). **Apply & draft revised copy** → `revise()` calls the
  copy model → **inline revised-copy preview** (Markdown) with Copy + **Send brief to
  Step 2** (`requestRevisions` → `revisionNote` banner). Export md now includes
  summary/stats/recs/revised copy.
- **Seed**: "Load example run" now builds a full **`stage:'complete'`** focus group
  (moderator opening + per-beat turns + stats + summary + recommendations).

**Build:** clean at each step. Recharts stayed removed (stats use CSS bars). **Not yet
committed/deployed.**

---

## 15. Navigation redesign (BUILT)

Foundation was demoted from a co-equal top-level area tab to a **corner dropdown**,
and the **Editorial Lab pipeline is now the primary center nav**.
- `src/views/AppShell.tsx` rewritten: removed the `UnifiedNav`/`TOP_NAV`/area-tab
  model. **`PipelineNav`** (center) = the 6 steps as a numbered stepper (active glows
  orange w/ label; done = green check derived from real pipeline artifacts, not just
  `currentStep`; upcoming dim; thin connectors). **`FoundationMenu`** = a right-cluster
  "Foundation" button (grouped with Model Router + Settings) opening a dropdown of
  Overview / Brand Memory / Brand Profile (click-away + Esc close; highlights active).
- `nav.ts` `FOUNDATION`/`PIPELINE` and `StepRail`'s `PIPELINE_STEPS` are unchanged and
  still the single source of truth. (The `StepRail` *component* is now unused but kept.)

**Build:** clean. Not yet committed/deployed.

---

## 11. Working style / preferences observed
- User iterates fast, says "go"/"yes" to proceed; likes: critique-first, then a
  **phased plan**, then build phase-by-phase with a build check each time.
- Keep the **UI philosophy consistent** across stages (master-detail).
- Commit + deploy when asked; always remind about the Pages "Source = GitHub
  Actions" setting.
- Report honestly: if a build/deploy step is unverified or failed, say so.
