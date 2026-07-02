// Seed compliance rulebook — synthetic but realistic. Merged at runtime with the
// brand's own compliance fingerprint. Consumed by the Step 4 compliance engine
// (Increment 3); authored now so the rulebook is reviewable from day one.

import type { RuleBook } from '@/types'

export const SEED_RULEBOOK: RuleBook = {
  legalLines: [
    {
      id: 'll_fdic',
      text: 'Member FDIC',
      appliesWhen: 'Any deposit product or general bank brand communication.',
    },
    {
      id: 'll_ehl',
      text: 'Equal Housing Lender',
      appliesWhen: 'Any mortgage, home equity, or housing-related lending content.',
    },
    {
      id: 'll_nmls',
      text: 'NMLS ID #________',
      appliesWhen: 'Mortgage and consumer-lending originations.',
    },
    {
      id: 'll_copyright',
      text: '© Capital One. All rights reserved.',
      appliesWhen: 'Owned published content (web, blog, email).',
    },
  ],
  rules: [
    {
      id: 'rule_guaranteed',
      category: 'UDAAP — Deceptive Practice',
      citation: 'Dodd-Frank §1031 / §1036 (UDAAP)',
      title: 'No guarantees of approval or outcomes',
      description:
        'Avoid "guaranteed," "guaranteed approval," or any language implying a certain outcome a consumer cannot be assured of. Creates a deceptive net impression.',
      defaultSeverity: 'Critical',
      triggers: ['guaranteed', 'guarantee approval', 'guaranteed approval', '100% approval'],
    },
    {
      id: 'rule_preapproved',
      category: 'Advertising — Firm Offer of Credit',
      citation: 'FCRA §604/§615 (prescreen) & Reg B',
      title: 'Use "pre-qualified" unless a true firm offer exists',
      description:
        '"Pre-approved" implies a firm offer of credit and triggers FCRA prescreen obligations. Use "pre-qualified" for soft-pull, non-binding offers.',
      defaultSeverity: 'Major',
      triggers: ['pre-approved', 'preapproved', 'pre approved'],
    },
    {
      id: 'rule_apr_disclosure',
      category: 'Reg Z / TILA — Required Disclosure',
      citation: 'Reg Z 12 CFR §1026.16 (advertising)',
      title: 'APR mentions require rate/fee disclosure',
      description:
        'If an advertisement states a rate (e.g., intro APR), it must clearly disclose the terms: the APR, when it applies, the go-to rate, and any fees. A representative example is expected.',
      defaultSeverity: 'Critical',
      triggers: ['apr', 'intro apr', '0%', 'interest rate', 'balance transfer'],
      topics: ['apr', 'balance-transfer'],
    },
    {
      id: 'rule_bt_fee',
      category: 'Reg Z / TILA — Fee Disclosure',
      citation: 'Reg Z 12 CFR §1026.16',
      title: 'Balance-transfer offers must disclose the transfer fee',
      description:
        'Balance-transfer promotions must disclose the balance-transfer fee (e.g., 3%) and the duration/terms of any promotional rate.',
      defaultSeverity: 'Major',
      triggers: ['balance transfer', 'transfer your balance'],
      topics: ['balance-transfer'],
    },
    {
      id: 'rule_best_superlative',
      category: 'FTC — Substantiation',
      citation: 'FTC Act §5 (unfair/deceptive) — substantiation',
      title: 'Unsubstantiated superlatives ("best", "#1")',
      description:
        'Comparative or superlative claims ("best rewards," "#1 card," "lowest rates") require competent and reliable substantiation, cited and current. Otherwise soften or remove.',
      defaultSeverity: 'Major',
      triggers: ['best', '#1', 'number one', 'lowest', 'unbeatable', 'top-rated'],
    },
    {
      id: 'rule_free',
      category: 'FTC — Use of "Free"',
      citation: 'FTC Guide Concerning Use of the Word "Free"',
      title: 'Qualify "free" / "no fees"',
      description:
        'Unqualified "free" or "no fees" can mislead if conditions or other fees apply. Qualify scope (e.g., "no annual fee") and disclose other applicable fees.',
      defaultSeverity: 'Minor',
      triggers: ['free', 'no fees', 'fee-free', 'zero fees'],
    },
    {
      id: 'rule_creditscore_edu',
      category: 'Brand Standard — Credit Score Caveat',
      citation: 'Brand fingerprint + UDAAP net-impression',
      title: 'Credit-score tools must carry educational caveat',
      description:
        'References to credit scores / CreditWise must clarify the score is for educational purposes and is not a credit decision or guarantee of approval.',
      defaultSeverity: 'Minor',
      triggers: ['credit score', 'creditwise', 'fico'],
      topics: ['credit-score'],
    },
    {
      id: 'rule_fairlending_proxy',
      category: 'Reg B / ECOA — Fair Lending',
      citation: 'Reg B 12 CFR §1002 (ECOA)',
      title: 'No protected-class targeting or proxies',
      description:
        'Targeting or messaging must not use protected classes (race, color, religion, national origin, sex, marital status, age, receipt of public assistance) or close proxies (e.g., ZIP as race proxy).',
      defaultSeverity: 'Critical',
      triggers: ['by race', 'religion', 'national origin', 'zip code targeting'],
    },
    {
      id: 'rule_rewards_caveat',
      category: 'Reg Z / Advertising — Rewards Terms',
      citation: 'Reg Z §1026.16 + FTC substantiation',
      title: 'Rewards earn/redemption must be caveated',
      description:
        'Rewards rate and redemption claims ("unlimited," "miles never expire") must reference earn caps, categories, and redemption terms where applicable.',
      defaultSeverity: 'Minor',
      triggers: ['unlimited rewards', 'miles', 'cash back', 'points', 'never expire'],
      topics: ['rewards'],
    },
    {
      id: 'rule_trademark',
      category: 'Legal — Trademark / Comparative',
      citation: 'Lanham Act — comparative advertising',
      title: 'Competitor references and trademarks',
      description:
        'Comparative claims naming competitors must be truthful, substantiated, and use marks nominatively. Avoid implying partnership or disparagement.',
      defaultSeverity: 'Minor',
      triggers: ['vs.', 'compared to', 'better than'],
    },
  ],
  disclosuresByTopic: {
    apr: [
      'State the intro APR, the duration, the go-to APR (range), and how the variable rate is determined.',
      'Disclose any balance-transfer or cash-advance fees.',
      'Include a representative example where a rate is featured.',
    ],
    'balance-transfer': [
      'Disclose the balance-transfer fee (e.g., 3% of the amount transferred).',
      'State the promotional period and the rate after it ends.',
    ],
    rewards: [
      'Disclose earn rate caps, eligible categories, and redemption terms.',
      'Avoid implying value not supported by the program terms.',
    ],
    'credit-score': [
      'State the score is for educational purposes and is not a credit decision.',
      'Clarify the tool is free and available to everyone.',
    ],
    'pre-qualification': [
      'Clarify pre-qualification is not a guarantee of approval and not a firm offer of credit.',
      'If a soft inquiry, state that checking will not affect the credit score.',
    ],
  },
}
