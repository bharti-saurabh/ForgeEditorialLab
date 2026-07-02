// Seed completed end-to-end run (meta). The full run payload (brief, draft with
// planted compliance issues, hero image, compliance review, audit trail,
// package, persona panel, survey) is assembled across Increments 2–6 and loaded
// in Increment 5 so the demo opens on a finished example. This meta stub lets
// the shell reference the example today. Synthetic / illustrative.

import type { CompletedRunMeta } from '@/types'

export const SEED_COMPLETED_RUN: CompletedRunMeta = {
  topicId: 'topic_bt_guide',
  title: 'Balance transfer 101: how to move debt the smart way',
  summary:
    'A finished example run: brief → on-brand draft (with deliberately planted compliance issues) → hero image → compliance review that catches the issues with rules cited → human sign-off → publish-ready package → 12-persona Persona Lab with survey and recommendation.',
  complianceScore: 78,
  recommendation: 'Revise — apply two compliance rewrites, then ship to A/B test.',
  note: 'Illustrative demo content. Wired in Increment 5.',
}
