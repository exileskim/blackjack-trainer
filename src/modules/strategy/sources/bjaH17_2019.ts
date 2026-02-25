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
  readonly group: 'I18' | 'Fab4'
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
  ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'Rh'],
  ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'Rh', 'Rh', 'Rh'],
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
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'Rp'],
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

const ILLUSTRIOUS_18_NO_INSURANCE: DeviationSourceRow[] = [
  { name: '16 vs 10: Stand', playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 0, group: 'I18' },
  { name: '15 vs 10: Stand', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 4, group: 'I18' },
  { name: '20 vs 5: Split', playerTotal: 20, isSoftHand: false, isPair: true, dealerUpValue: 5, basicAction: 'stand', deviationAction: 'split', tcThreshold: 5, group: 'I18' },
  { name: '20 vs 6: Split', playerTotal: 20, isSoftHand: false, isPair: true, dealerUpValue: 6, basicAction: 'stand', deviationAction: 'split', tcThreshold: 4, group: 'I18' },
  { name: '10 vs 10: Double', playerTotal: 10, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'double', tcThreshold: 4, group: 'I18' },
  { name: '12 vs 3: Stand', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 3, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 2, group: 'I18' },
  { name: '12 vs 2: Stand', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 2, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 3, group: 'I18' },
  { name: '11 vs A: Double', playerTotal: 11, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'double', tcThreshold: 1, group: 'I18' },
  { name: '9 vs 2: Double', playerTotal: 9, isSoftHand: false, isPair: false, dealerUpValue: 2, basicAction: 'hit', deviationAction: 'double', tcThreshold: 1, group: 'I18' },
  { name: '10 vs A: Double', playerTotal: 10, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'double', tcThreshold: 4, group: 'I18' },
  { name: '9 vs 7: Double', playerTotal: 9, isSoftHand: false, isPair: false, dealerUpValue: 7, basicAction: 'hit', deviationAction: 'double', tcThreshold: 3, group: 'I18' },
  { name: '16 vs 9: Stand', playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 9, basicAction: 'hit', deviationAction: 'stand', tcThreshold: 5, group: 'I18' },
  { name: '13 vs 2: Hit', playerTotal: 13, isSoftHand: false, isPair: false, dealerUpValue: 2, basicAction: 'stand', deviationAction: 'hit', tcThreshold: -1, group: 'I18' },
  { name: '12 vs 4: Hit', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 4, basicAction: 'stand', deviationAction: 'hit', tcThreshold: 0, group: 'I18' },
  { name: '12 vs 5: Hit', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 5, basicAction: 'stand', deviationAction: 'hit', tcThreshold: -2, group: 'I18' },
  { name: '12 vs 6: Hit', playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 6, basicAction: 'stand', deviationAction: 'hit', tcThreshold: -1, group: 'I18' },
  { name: '13 vs 3: Hit', playerTotal: 13, isSoftHand: false, isPair: false, dealerUpValue: 3, basicAction: 'stand', deviationAction: 'hit', tcThreshold: -2, group: 'I18' },
]

const FAB_4: DeviationSourceRow[] = [
  { name: '14 vs 10: Surrender', playerTotal: 14, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 3, group: 'Fab4' },
  { name: '15 vs 10: Surrender', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 0, group: 'Fab4' },
  { name: '15 vs 9: Surrender', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 9, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 2, group: 'Fab4' },
  { name: '15 vs A: Surrender', playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit', deviationAction: 'surrender', tcThreshold: 1, group: 'Fab4' },
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
      'Includes basic-strategy base actions plus I18/Fab4 deviation entries used by current trainer logic.',
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
  deviations: [...ILLUSTRIOUS_18_NO_INSURANCE, ...FAB_4] as const,
} as const

