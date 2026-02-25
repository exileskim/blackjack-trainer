import type { Card, RuleConfig } from '@/modules/domain/types.ts'
import type { PlayerAction } from '@/modules/domain/enums.ts'
import { cardValue, handTotal, isSoft } from '@/modules/blackjack/rules.ts'
import { BJA_H17_2019_SOURCE } from '@/modules/strategy/sources/bjaH17_2019.ts'

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

export const DEVIATION_SOURCE = BJA_H17_2019_SOURCE.metadata
export const ALL_DEVIATIONS: readonly Deviation[] = BJA_H17_2019_SOURCE.deviations

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
