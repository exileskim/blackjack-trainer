import type { Card, RuleConfig } from '@/modules/domain/types.ts'
import type { PlayerAction } from '@/modules/domain/enums.ts'
import { cardValue, handTotal, isSoft } from '@/modules/blackjack/rules.ts'

/**
 * BJ-035: Illustrious 18 + Fab 4 deviation layer.
 *
 * True-count-triggered deviations from basic strategy. Each deviation
 * specifies a threshold: when TC >= threshold (or <= for negative),
 * the player should deviate from basic strategy.
 */

export interface Deviation {
  readonly name: string
  readonly playerTotal: number
  readonly isSoftHand: boolean
  readonly isPair: boolean
  readonly dealerUpValue: number  // 2-11 (11 = Ace)
  readonly basicAction: PlayerAction
  readonly deviationAction: PlayerAction
  readonly tcThreshold: number    // positive = deviate at >= TC, negative = deviate at <= TC
  readonly group: 'I18' | 'Fab4'
}

// ─── Illustrious 18 ────────────────────────────────────────────────────────
// The 18 most valuable index plays, ordered by EV impact.
const ILLUSTRIOUS_18: Deviation[] = [
  // Insurance is handled separately (not a hand action), so we skip it.
  // The remaining I18 plays:
  { name: '16 vs 10: Stand',        playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit',    deviationAction: 'stand',  tcThreshold: 0,  group: 'I18' },
  { name: '15 vs 10: Stand',        playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit',    deviationAction: 'stand',  tcThreshold: 4,  group: 'I18' },
  { name: '20 vs 5: Split',         playerTotal: 20, isSoftHand: false, isPair: true,  dealerUpValue: 5,  basicAction: 'stand',  deviationAction: 'split',  tcThreshold: 5,  group: 'I18' },
  { name: '20 vs 6: Split',         playerTotal: 20, isSoftHand: false, isPair: true,  dealerUpValue: 6,  basicAction: 'stand',  deviationAction: 'split',  tcThreshold: 4,  group: 'I18' },
  { name: '10 vs 10: Double',       playerTotal: 10, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit',    deviationAction: 'double', tcThreshold: 4,  group: 'I18' },
  { name: '12 vs 3: Stand',         playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 3,  basicAction: 'hit',    deviationAction: 'stand',  tcThreshold: 2,  group: 'I18' },
  { name: '12 vs 2: Stand',         playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 2,  basicAction: 'hit',    deviationAction: 'stand',  tcThreshold: 3,  group: 'I18' },
  { name: '11 vs A: Double',        playerTotal: 11, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit',    deviationAction: 'double', tcThreshold: 1,  group: 'I18' },
  { name: '9 vs 2: Double',         playerTotal: 9,  isSoftHand: false, isPair: false, dealerUpValue: 2,  basicAction: 'hit',    deviationAction: 'double', tcThreshold: 1,  group: 'I18' },
  { name: '10 vs A: Double',        playerTotal: 10, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit',    deviationAction: 'double', tcThreshold: 4,  group: 'I18' },
  { name: '9 vs 7: Double',         playerTotal: 9,  isSoftHand: false, isPair: false, dealerUpValue: 7,  basicAction: 'hit',    deviationAction: 'double', tcThreshold: 3,  group: 'I18' },
  { name: '16 vs 9: Stand',         playerTotal: 16, isSoftHand: false, isPair: false, dealerUpValue: 9,  basicAction: 'hit',    deviationAction: 'stand',  tcThreshold: 5,  group: 'I18' },
  { name: '13 vs 2: Hit',           playerTotal: 13, isSoftHand: false, isPair: false, dealerUpValue: 2,  basicAction: 'stand',  deviationAction: 'hit',    tcThreshold: -1, group: 'I18' },
  { name: '12 vs 4: Hit',           playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 4,  basicAction: 'stand',  deviationAction: 'hit',    tcThreshold: 0,  group: 'I18' },
  { name: '12 vs 5: Hit',           playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 5,  basicAction: 'stand',  deviationAction: 'hit',    tcThreshold: -2, group: 'I18' },
  { name: '12 vs 6: Hit',           playerTotal: 12, isSoftHand: false, isPair: false, dealerUpValue: 6,  basicAction: 'stand',  deviationAction: 'hit',    tcThreshold: -1, group: 'I18' },
  { name: '13 vs 3: Hit',           playerTotal: 13, isSoftHand: false, isPair: false, dealerUpValue: 3,  basicAction: 'stand',  deviationAction: 'hit',    tcThreshold: -2, group: 'I18' },
]

// ─── Fab 4 surrenders ───────────────────────────────────────────────────────
// The 4 most valuable surrender deviations.
const FAB_4: Deviation[] = [
  { name: '14 vs 10: Surrender',    playerTotal: 14, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit',       deviationAction: 'surrender', tcThreshold: 3,  group: 'Fab4' },
  { name: '15 vs 10: Surrender',    playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 10, basicAction: 'hit',       deviationAction: 'surrender', tcThreshold: 0,  group: 'Fab4' },
  { name: '15 vs 9: Surrender',     playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 9,  basicAction: 'hit',       deviationAction: 'surrender', tcThreshold: 2,  group: 'Fab4' },
  { name: '15 vs A: Surrender',     playerTotal: 15, isSoftHand: false, isPair: false, dealerUpValue: 11, basicAction: 'hit',       deviationAction: 'surrender', tcThreshold: 1,  group: 'Fab4' },
]

export const ALL_DEVIATIONS: readonly Deviation[] = [...ILLUSTRIOUS_18, ...FAB_4]

/**
 * Given a hand state and true count, find the applicable deviation (if any).
 * Returns null when basic strategy is correct, or the Deviation to follow.
 */
export function findApplicableDeviation(
  playerCards: Card[],
  dealerUpcard: Card,
  trueCount: number,
  rules: RuleConfig,
  isSplitHand = false,
): Deviation | null {
  const total = handTotal(playerCards)
  const soft = isSoft(playerCards)
  const hasTwoCards = playerCards.length === 2
  const isPair = hasTwoCards && !isSplitHand &&
    cardValue(playerCards[0]!) === cardValue(playerCards[1]!)
  const dealerUp = cardValue(dealerUpcard)

  for (const dev of ALL_DEVIATIONS) {
    // Match hand characteristics
    if (dev.playerTotal !== total) continue
    if (dev.isSoftHand !== soft) continue
    if (dev.dealerUpValue !== dealerUp) continue

    // Pair deviations only apply to actual pairs
    if (dev.isPair && !isPair) continue
    if (!dev.isPair && isPair && dev.playerTotal === 20) continue // 10,10 pair handled by pair deviation

    // Surrender deviations require surrender to be allowed
    if (dev.deviationAction === 'surrender' && !rules.surrenderAllowed) continue
    if (dev.deviationAction === 'surrender' && isSplitHand) continue
    if (dev.deviationAction === 'surrender' && !hasTwoCards) continue

    // Double deviations require ability to double
    if (dev.deviationAction === 'double' && !hasTwoCards) continue
    if (dev.deviationAction === 'double' && isSplitHand && !rules.doubleAfterSplit) continue

    // Split deviations require ability to split
    if (dev.deviationAction === 'split' && !isPair) continue

    // Check threshold direction
    if (dev.tcThreshold >= 0 && trueCount >= dev.tcThreshold) return dev
    if (dev.tcThreshold < 0 && trueCount <= dev.tcThreshold) return dev
  }

  return null
}

/**
 * Returns the optimal action considering both basic strategy and deviations.
 * If a deviation applies, returns the deviation action; otherwise falls through
 * to basic strategy (caller should use getBasicStrategyAction for that).
 */
export function getDeviationAction(
  playerCards: Card[],
  dealerUpcard: Card,
  trueCount: number,
  rules: RuleConfig,
  isSplitHand = false,
): { action: PlayerAction; deviation: Deviation } | null {
  const dev = findApplicableDeviation(playerCards, dealerUpcard, trueCount, rules, isSplitHand)
  if (!dev) return null
  return { action: dev.deviationAction, deviation: dev }
}
