# Forge — Learnings

Distilled, transferable lessons from building Forge (Editorial Lab): a
client-side, demo-first, compliance-aware multi-model content tool. This is the
"what we'd tell the next builder" file — separate from `PROGRESS.md` (status) and
the per-stage detail.

---

## 1. The biggest recurring insight: stages that validate a *proxy* feel "disconnected"

Three different stages (Compliance, Publish, Persona Lab) each independently felt
"disconnected," and every time the root cause was the same: **the stage validated
a stand-in (a score, a topic title, two numbers) instead of the actual artifact
(the draft copy, the visual, the channel, the CTA).**

- The fix was always the same shape: **feed the real content into the stage.** The
  compliance gate had to reconnect to the draft; Persona Lab's focus group had to
  actually read the copy; Publish had to carry the *approved* draft through instead
  of re-deriving it.
- **Litmus test for any "review/validate/score" feature:** if you edit the actual
  content and the output doesn't change, the stage is disconnected. It's judging a
  shadow.

## 2. Product / UX learnings

- **Make one decision upstream, honor it everywhere.** Channel became a first-class
  choice at Step 2 that flowed through brief → draft → visuals → preview →
  compliance → publish. Deciding it once (not re-deciding at the end) removed a
  whole class of inconsistency.
- **Gates must be resolvable, not just informational.** A red flag you can't act on
  is noise. Every check got a resolve/override/edit path with an accountable
  reviewer — that's what makes it a *gate* vs. a *warning label*.
- **Parity across stages builds trust.** Once one stage was editable with
  Save/Revert, every stage needed it. Inconsistent capability reads as "half-built."
- **Carry context forward, don't drop it.** "Send back for revision" was useless
  until it carried *what to fix* (weakest metric, objections, weak segments) into
  the next stage as a visible brief.
- **Don't fake precision on synthetic data.** Showing `Trust 63/100` from a panel of
  4 synthetic voices implies survey-grade rigor. Use confidence bands, "n=k
  synthetic" labels, and let re-runs resample — honesty beats false exactness.
- **Qualitative can beat quantitative.** Replacing a numeric survey engine with a
  simulated, streamed focus group was more believable *and* more useful — you get
  the "why," not just a number.
- **Consistent layout is a feature.** A single master-detail philosophy (setup on
  top → list ↔ detail → artifacts below) applied to every stage made a 6-step tool
  feel like one product.

## 3. Architecture / technical learnings

- **Demo-first is the highest-leverage pattern.** Every AI/external call has a
  deterministic, seeded fallback (`runChat({..., demo})` serves it when no key is
  set). Result: the app is fully usable with zero config, demos never fail, and you
  develop offline. Non-negotiable for anything client-side.
- **Never persist heavy payloads.** A "Live call failed (quota exceeded)" bug was
  actually `localStorage` overflowing on base64 images written inside the call path.
  Fix: `partialize` strips `data:` URLs before persist + a `safeStorage` wrapper
  swallows quota errors. Lesson: **a storage error can masquerade as an API error.**
- **Persist migrations need discipline.** Zustand's top-level spread backfills new
  *top-level* fields but NOT nested objects. When a nested snapshot's schema changes
  (the Persona shape changed 3×), **bump the version and drop the stale nested
  object** so the new UI never reads a half-populated shape. Guard on a field the
  new shape must have (`if (!persona.stage) persona = null`).
- **Isolate heavy dependencies to a lazy chunk.** Recharts lived only in the lazy
  Persona view (~393 KB chunk). When that view stopped using it, it fully
  tree-shook to nothing. Keep viz/PDF/etc. out of the main bundle and behind a
  `lazy()` boundary.
- **"Streaming" without token streaming.** For a live-discussion feel, generate per
  unit (per agenda beat) and reveal turns with timed `sleep()` — reads as live,
  works identically in demo and live, no SSE plumbing.
- **Coerce LLM JSON against a deterministic base.** Pattern: build a demo object,
  then `coerceX(base, parsed)` overlays only the *valid* model fields (enum-checked,
  non-empty). One code path for live + demo; malformed output degrades gracefully.
- **Guardrail regexes: word boundaries, not substrings.** A substring blocklist
  flagged "management" (contains "men") and "manage" (contains "age"). `\b…\b`
  per-category patterns killed the false positives.
- **Preserve placeholders through every transform.** `[APR]`, `[fee]`, `[term]`
  survive brief → draft → adapt → revise; real figures are only added at the
  compliance gate. Prompts explicitly forbid inventing them.
- **Strict TS is a feature.** `noUnusedLocals`/`noUnusedParameters` caught dead code
  every build. (Gotcha: destructure-with-rest, `const {id: _drop, ...r} = o`, is
  exempted — use it to omit fields.)
- **Build after every change.** `tsc -b && vite build` after each edit caught issues
  while context was fresh. Cheap insurance.

## 4. Domain / compliance learnings

- **Decision-support, never legal advice.** The compliance engine flags and cites;
  a named human signs off. AI never auto-approves.
- **Don't scan your own internals.** The gate once scanned the *image prompt* (which
  contained "no depiction of guaranteed wealth") and raised phantom Critical
  findings on text absent from the post. Scan only the *published* text.
- **Segment on behavior, never identity.** Audiences/personas are needs-based only —
  never protected classes or proxies (age, race, sex, marital status, ZIP…) per
  Reg B / ECOA. Enforce it in both the fairness screen *and* the generation prompts.
- **Label synthetic as synthetic.** Every audience signal is "directional,
  illustrative" in the UI. It's a compass, not a census.

## 5. Process learnings

- **Critique → phased plan → build phase-by-phase (build-check each phase).** This
  rhythm kept large reworks safe and reviewable, and let the user steer between
  phases.
- **Confirm scope before a big rewrite.** A couple of focused questions ("replace or
  keep both?", "stream or batch?") prevented building the wrong thing at scale.
- **Be honest about constraints, even when it means saying "not that way."** The
  "fetch any URL/video" request collided with CORS + the static-site + no-external-
  calls constraints. Naming that — and proposing a reader-API/paste path that
  actually works — beats shipping something broken or silently breaking a promise.
- **Know your platform's limits.** Static hosting (GitHub Pages) means no server →
  no arbitrary fetching, no secrets, no background jobs. Design within that or move
  hosts deliberately.
- **The boring deploy gotcha:** GitHub Pages must be set to **Source = "GitHub
  Actions"** (not "deploy from a branch") for a build-workflow deploy.

## 6. Top pitfalls (the quick list)

1. A stage that scores a *proxy* instead of the *artifact* → feels disconnected.
2. Persisting base64/large blobs → silent `localStorage` quota failures.
3. Changing a nested persisted shape without a version bump + stale-drop → crash on
   reload.
4. Substring guardrails → false positives; use word boundaries.
5. Presenting synthetic numbers as precise → false confidence.
6. Informational-only checks → users can't act; make them resolvable.
7. Scanning internal prompt/metadata for compliance → phantom findings.
8. Assuming a static site can fetch the web → CORS wall.
