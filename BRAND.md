# Forge — Visual Language & Straive Brand Guidelines

Forge is a Straive product. Its interface follows Straive's brand expression
(bold, modern, "connecting the dots") adapted into an enterprise data-operations
UI — the look established by Straive's own apps like *Investigation Assist*:
**deep-navy chrome, a single confident orange accent, and a calm, data-dense
light workspace.**

> Source of truth: Straive's primary brand color is **Aerospace Orange `#FF5000`**
> on white (per the 2021 rebrand, "Orange represents the wave of innovation").
> We pair it with a deep navy app chrome for contrast and gravitas.

---

## 1. Color

### Brand
| Token | Hex | Use |
|---|---|---|
| **Straive Orange** | `#FF5000` | The one accent. Primary actions, active state, key figures, the logo mark, focus. Use *sparingly* — it should always mean "this matters / act here". |
| Orange 600 (hover) | `#E84600` | Hover/active press on orange surfaces. |
| Orange Soft | `#FFF1EA` | Tinted backgrounds for orange badges, selected rows, highlights. |

### Chrome (navy)
The dark application frame — top bar, left rail, dark panels.
| Token | Hex | Use |
|---|---|---|
| Navy 900 | `#0D1B2E` | Top bar background. |
| Navy 800 | `#122139` | Left sidebar background. |
| Navy 700 | `#1B2E4A` | Hover/raised surfaces on navy. |
| Navy 300 | `#90A6C6` | Muted text/icons on navy. |
| Navy 200 | `#C2CEE0` | Secondary text on navy. |

### Surface & ink (light workspace)
| Token | Hex | Use |
|---|---|---|
| App background | `#F5F7FA` (`ink-50`) | The working canvas behind cards. |
| Card | `#FFFFFF` | All content surfaces. |
| Hairline | `#CDD5E0` (`ink-200`) | Borders, dividers. |
| Ink 800 | `#1F2A3C` | Primary body text. |
| Ink 500 | `#566A89` | Secondary text, labels. |
| Ink 400 | `#7689A6` | Tertiary / placeholder. |

### Status (semantic — never repurposed for decoration)
| Token | Hex | Meaning |
|---|---|---|
| OK | `#1F9D61` | Pass, healthy, on-brand, approved. |
| Warn | `#E0901A` | Caution, review, medium severity. |
| Crit | `#D23B34` | Fail, blocked, high severity, critical risk. |
| Info | `#2A7FD0` | Neutral information, links. |

**Rule:** orange is *brand/action*, not *status*. A red number means risk; an
orange number means "the headline metric / the thing to act on."

---

## 2. Typography

- **Family:** Inter (UI), with system fallback. `ui-monospace` for IDs, tokens,
  latencies, and any machine value.
- **Scale:** data-dense. Page titles `text-lg/xl` semibold; section titles
  `text-sm` semibold uppercase tracking-wide; body `text-sm`; meta `text-xs`.
- **Labels:** `text-[11px] font-semibold uppercase tracking-wider` in `ink-500`
  (or `navy-300` on dark). This "eyebrow" label is a signature of the look.
- **Numbers:** large KPIs are `font-bold tabular-nums`; pair with a small caption.

---

## 3. Logo

- **Top-left, always.** Straive flame/spark mark in orange + "Straive" wordmark
  in white on the navy bar, then a thin divider, then the product lockup
  **Forge · Editorial Lab**. (Mirrors Straive's own apps: `Straive | <Product>`.)
- On light surfaces, the wordmark renders in `navy-900`.
- Minimum clear space around the mark = the height of the mark's "spark".

---

## 4. Layout system

- **Dark chrome, light work.** Persistent **navy top bar** (logo, context,
  model + Live/Demo status, settings) and a **navy left rail** (grouped
  navigation). Content sits on the light canvas in white cards.
- **Numbered step rail.** The 6-step pipeline is shown as a horizontal numbered
  progress rail (active = orange, done = green check, upcoming = muted) — the
  primary "where am I in the process" cue, clickable to navigate.
- **Cards over chrome.** Group everything in `rounded-xl` white cards with a
  hairline border and the soft `shadow-card`. Generous internal padding
  (`p-5`/`p-6`); align to an 8px rhythm.
- **KPI tiles.** Metrics shown as equal-width tiles: big `tabular-nums` value +
  small uppercase caption; color the value only when it carries status.
- **Density with air.** Tables and lists are compact, but sections breathe with
  consistent `gap-4`/`gap-6` and clear section headers.

---

## 5. Components — defaults

- **Button / primary** = Straive orange, white text. **navy** = dark solid.
  **secondary** = white + hairline. Keep ≤1 orange button per view region.
- **Badge** = pill, tinted-10% background + colored text + 20% border; `dot`
  variant for live status.
- **Score** = ring gauge or bar; color by band (≥80 ok / ≥60 warn / else crit).
- **Disclaimer banners** (legal-not-advice / synthetic-directional /
  illustrative-data) are first-class and always visible where relevant.

---

## 6. Voice in UI

Confident, precise, operator-grade. Short labels, active verbs ("Run analysis",
"Re-derive profile"). Always surface *why a model was chosen* and *that synthetic
output is directional* — transparency is part of the brand.

---

*Synthetic / illustrative data throughout. Forge is decision support, not legal
advice; a human signs off.*
