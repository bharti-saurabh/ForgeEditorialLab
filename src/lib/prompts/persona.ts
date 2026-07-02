// Prompts + seeded demo for Step 6 (Persona Lab) focus-group synthesis. The
// per-segment reactions and survey scores are simulated deterministically in
// lib/persona.ts; the strategy model writes the synthesis narrative over those
// findings. The demo synthesis is grounded in the actual comments + metrics so
// the read holds with zero keys. All output is directional signal, not truth.

import type {
  FocusComment,
  PersonaRecommendation,
  SurveyMetric,
  TopicOpportunity,
} from '@/types'

export const PERSONA_SYSTEM = `You are a consumer-insights lead for a regulated U.S. card issuer. You synthesize a synthetic focus group into a crisp, decision-ready read for a marketing team. Be candid about weaknesses. Never treat synthetic results as statistically representative — frame them as directional signal. Do not reference protected classes; the panel is behavioral only. Write 2 short paragraphs, then a line starting "Recommendation:".`

export function buildSynthesisPrompt(
  topic: TopicOpportunity,
  comments: FocusComment[],
  metrics: SurveyMetric[],
  rec: PersonaRecommendation,
): string {
  const commentLines = comments
    .map((c) => `- [${c.sentiment}] ${c.segmentName}: "${c.quote}"`)
    .join('\n')
  const metricLines = metrics.map((m) => `${m.label} ${m.average}/100`).join(', ')
  return `CONTENT UNDER TEST: ${topic.title}

SYNTHETIC PANEL REACTIONS:
${commentLines}

SURVEY AVERAGES: ${metricLines}
ENGINE VERDICT: ${rec.verdict} — ${rec.headline}

Synthesize the focus group. What resonates, what drags, and which segments to watch. Then a "Recommendation:" line.`
}

export function demoSynthesis(
  topic: TopicOpportunity,
  comments: FocusComment[],
  metrics: SurveyMetric[],
  rec: PersonaRecommendation,
): string {
  const pos = comments.filter((c) => c.sentiment === 'positive').map((c) => c.segmentName)
  const neg = comments.filter((c) => c.sentiment === 'negative').map((c) => c.segmentName)
  const strongest = [...metrics].sort((a, b) => b.average - a.average)[0]
  const weakest = [...metrics].sort((a, b) => a.average - b.average)[0]
  const subject = topic.title.split(':')[0].toLowerCase()

  const p1 =
    `Across the panel, "${subject}" reads as ${strongest.label.toLowerCase()}-forward — ${strongest.label} scored highest at ${strongest.average}/100. ` +
    (pos.length
      ? `${pos.slice(0, 3).join(', ')} responded most warmly, seeing a straight, no-hype answer they could act on. `
      : `No segment was strongly enthusiastic, though most found it competent and clear. `) +
    `The transparent, "no surprises" framing is doing real work here.`

  const p2 =
    `The drag is ${weakest.label.toLowerCase()} (${weakest.average}/100). ` +
    (neg.length
      ? `${neg.join(', ')} stayed unconvinced — the recurring snag is fine-print wariness and wanting the specific numbers before acting. `
      : `Even the mixed reactions circled the same request: concrete specifics and proof before they commit. `) +
    `That is an optimization opportunity, not a red flag, and it points cleanly at what to test next.`

  return `${p1}\n\n${p2}\n\nRecommendation: ${rec.headline} ${rec.rationale}`
}
