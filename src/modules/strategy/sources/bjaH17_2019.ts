import type { PlayerAction } from '@/modules/domain/enums.ts'

export type RawAction =
  | 'H'
  | 'S'
  | 'D'
  | 'Ds'
  | 'P'
  | 'Ph'
  | 'Rh'
  | 'Rs'
  | 'Rp'

export interface StrategySourceMetadata {
  readonly id: 'bja-h17-2019'
  readonly provider: 'Blackjack Apprenticeship'
  readonly chartName: 'H17 Deviation Chart'
  readonly sourceUrl: 'https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf'
  readonly pdfMd5: 'de7471c5d1e232bf85e790b8a83ff9e9'
  readonly retrievedAt: string
  readonly notes: readonly string[]
}

export interface DeviationSourceRow {
  readonly name: string
  readonly playerTotal: number
  readonly isSoftHand: boolean
  readonly isPair: boolean
  readonly dealerUpValue: number
  readonly basicAction: PlayerAction
  readonly deviationAction: PlayerAction
  readonly tcThreshold: number
  readonly comparison: 'gte' | 'lte'
  readonly group: 'I18' | 'Fab4' | 'BJA'
}

export interface InsuranceSourceRule {
  readonly tcThreshold: number
  readonly comparison: 'gte' | 'lte'
}

const HARD_H17: RawAction[][] = [
  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'],
  ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'Rh'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'Rs'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
]

const HARD_S17_OVERRIDES: Record<string, RawAction> = {
  '11-A': 'D',
  '15-A': 'H',
  '17-A': 'S',
}

const SOFT_H17: RawAction[][] = [
  ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  ['Ds', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  ['S', 'S', 'S', 'S', 'Ds', 'S', 'S', 'S', 'S', 'S'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
]

const SOFT_S17_OVERRIDES: Record<string, RawAction> = {
  '18-A': 'S',
  '19-6': 'S',
}

const PAIRS_H17_DAS: RawAction[][] = [
  ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  ['H', 'H', 'H', 'Ph', 'Ph', 'H', 'H', 'H', 'H', 'H'],
  ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  ['Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
]

const PAIRS_NO_DAS_OVERRIDES: Record<string, RawAction> = {
  '0-0': 'H',
  '0-1': 'H',
  '1-0': 'H',
  '1-1': 'H',
  '2-0': 'H',
  '2-1': 'H',
  '2-2': 'H',
  '2-3': 'H',
  '2-4': 'H',
  '4-0': 'H',
}

const PAIRS_S17_OVERRIDES: Record<string, RawAction> = {
  '6-9': 'P',
}

const BJA_H17_DEVIATIONS: DeviationSourceRow[] = [
  // Late surrender indices on the chart.
  { name: '14 vs 10: Surrender (3+)', playerTotal: 14, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 3, comparison: 'gte', group: 'Fab4' },
  { name: '15 vs 10: Surrender (0-)', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 0, comparison: 'lte', group: 'Fab4' },
  { name: '15 vs 9: Surrender (2+)', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 9, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 2, comparison: 'gte', group: 'Fab4' },
  { name: '15 vs A: Surrender (-1+)', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: -1, comparison: 'gte', group: 'Fab4' },
  { name: '16 vs 8: Surrender (4+)', playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 8, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 4, comparison: 'gte', group: 'BJA' },
  { name: '16 vs 9: Surrender (-1-)', playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 9, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: -1, comparison: 'lte', group: 'BJA' },

  // Hard totals indices on the chart.
  { name: '16 vs 10: Stand (0+)', playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 0, comparison: 'gte', group: 'I18' },
  { name: '15 vs 10: Stand (4+)', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 4, comparison: 'gte', group: 'I18' },
  { name: '15 vs A: Stand (5+)', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 5, comparison: 'gte', group: 'BJA' },
  { name: '16 vs 9: Stand (4+)', playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 9, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 4, comparison: 'gte', group: 'I18' },
  { name: '16 vs A: Stand (3+)', playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 3, comparison: 'gte', group: 'BJA' },
  { name: '13 vs 2: Hit (-1-)', playerTotal: 13, isSoftHand: false, isPair: false, dealerUpValue: 2, basicAction: 'stand', deviationAction: 'hit', tcThreshold: -1, comparison: 'lte', group: 'I18' },
  { name: '12 vs 2: Stand (3+)', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 2, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 3, comparison: 'gte', group: 'I18' },
  { name: '12 vs 3: Stand (2+)', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 3, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 2, comparison: 'gte', group: 'I18' },
  { name: '12 vs 4: Hit (0-)', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 4, basicAction: 'stand', deviationAction: 'hit', tcThreshold: 0, comparison: 'lte', group: 'I18' },
  { name: '10 vs 10: Double (4+)', playerTotal: 10, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'double', tcThreshold: 4, comparison: 'gte', group: 'I18' },
  { name: '10 vs A: Double (3+)', playerTotal: 10, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'double', tcThreshold: 3, comparison: 'gte', group: 'I18' },
  { name: '9 vs 2: Double (1+)', playerTotal: 9, isSoftHand: false, isPair: false, dealerUpValue: 2, basicAction: 'hit', deviationAction: 'double', tcThreshold: 1, comparison: 'gte', group: 'I18' },
  { name: '9 vs 7: Double (3+)', playerTotal: 9, isSoftHand: false, isPair: false, dealerUpValue: 7, basicAction: 'hit', deviationAction: 'double', tcThreshold: 3, comparison: 'gte', group: 'I18' },
  { name: '8 vs 6: Double (2+)', playerTotal: 8, isSoftHand: false, isPair: false, dealerUpValue: 6, basicAction: 'hit', deviationAction: 'double', tcThreshold: 2, comparison: 'gte', group: 'BJA' },
  { name: '11 vs A: Double (1+)', playerTotal: 11, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'double', tcThreshold: 1, comparison: 'gte', group: 'I18' },

  // Soft totals indices on the chart.
  { name: 'A,8 vs 4: Double (3+)', playerTotal: 19, isSoftHand: true, isPair: false, dealerUpValue: 4, basicAction: 'stand', deviationAction: 'double', tcThreshold: 3, comparison: 'gte', group: 'BJA' },
  { name: 'A,8 vs 5: Double (1+)', playerTotal: 19, isSoftHand: true, isPair: false, dealerUpValue: 5, basicAction: 'stand', deviationAction: 'double', tcThreshold: 1, comparison: 'gte', group: 'BJA' },
  { name: 'A,8 vs 6: Stand (0-)', playerTotal: 19, isSoftHand: true, isPair: false, dealerUpValue: 6, basicAction: 'double', deviationAction: 'stand', tcThreshold: 0, comparison: 'lte', group: 'BJA' },
  { name: 'A,6 vs 2: Double (1+)', playerTotal: 17, isSoftHand: true, isPair: false, dealerUpValue: 2, basicAction: 'hit', deviationAction: 'double', tcThreshold: 1, comparison: 'gte', group: 'BJA' },

  // Pair splitting indices on the chart.
  { name: '10,10 vs 4: Split (6+)', playerTotal: 20, isSoftHand: false, isPair: true, dealerUpValue: 4, basicAction: 'stand', deviationAction: 'split', tcThreshold: 6, comparison: 'gte', group: 'BJA' },
  { name: '10,10 vs 5: Split (5+)', playerTotal: 20, isSoftHand: false, isPair: true, dealerUpValue: 5, basicAction: 'stand', deviationAction: 'split', tcThreshold: 5, comparison: 'gte', group: 'I18' },
  { name: '10,10 vs 6: Split (4+)', playerTotal: 20, isSoftHand: false, isPair: true, dealerUpValue: 6, basicAction: 'stand', deviationAction: 'split', tcThreshold: 4, comparison: 'gte', group: 'I18' },
]

export const BJA_H17_2019_SOURCE = {
  metadata: {
    id: 'bja-h17-2019',
    provider: 'Blackjack Apprenticeship',
    chartName: 'H17 Deviation Chart',
    sourceUrl: 'https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf',
    pdfMd5: 'de7471c5d1e232bf85e790b8a83ff9e9',
    retrievedAt: '2026-02-25',
    notes: [
      'Canonical strategy data source for this app.',
      'Implements BJA H17 chart basic actions and chart-listed index deviations.',
      'Late-surrender always hands (16v10, 16vA, 17vA) are represented in the base table.',
      'Insurance/even money (3+) is documented on the chart but not modeled as a player action in this app.',
    ],
  } as const satisfies StrategySourceMetadata,
  dealerUpcardOrder: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'] as const,
  basic: {
    hardH17: HARD_H17,
    hardS17Overrides: HARD_S17_OVERRIDES,
    softH17: SOFT_H17,
    softS17Overrides: SOFT_S17_OVERRIDES,
    pairsH17Das: PAIRS_H17_DAS,
    pairsNoDasOverrides: PAIRS_NO_DAS_OVERRIDES,
    pairsS17Overrides: PAIRS_S17_OVERRIDES,
  },
  insurance: {
    tcThreshold: 3,
    comparison: 'gte',
  } as const satisfies InsuranceSourceRule,
  deviations: BJA_H17_DEVIATIONS,
} as const
