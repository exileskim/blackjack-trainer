import type { Card, RuleConfig } from '@/modules/domain/types.ts'
import type { Rank, PlayerAction } from '@/modules/domain/enums.ts'
import { cardValue, handTotal, isSoft } from '@/modules/blackjack/rules.ts'
import { BJA_H17_2019_SOURCE, type RawAction } from '@/modules/strategy/sources/bjaH17_2019.ts'

/**
 * BJ-033: Rule-aware basic strategy engine.
 *
 * Returns the optimal basic strategy action for a given hand/dealer/rules
 * combination. Strategy tables are based on standard multi-deck basic strategy
 * with adjustments for rule variations (H17/S17, DAS, surrender).
 */

const {
  hardH17: HARD_H17,
  hardS17Overrides: HARD_S17_OVERRIDES,
  softH17: SOFT_H17,
  softS17Overrides: SOFT_S17_OVERRIDES,
  pairsH17Das: PAIRS_H17_DAS,
  pairsNoDasOverrides: PAIRS_NO_DAS_OVERRIDES,
  pairsS17Overrides: PAIRS_S17_OVERRIDES,
} = BJA_H17_2019_SOURCE.basic

export const BASIC_STRATEGY_SOURCE = BJA_H17_2019_SOURCE.metadata

// ─── Dealer upcard index ────────────────────────────────────────────────────
// Maps dealer upcard rank to column index 0-9 in strategy tables.
// Column order: 2, 3, 4, 5, 6, 7, 8, 9, 10, A
function dealerIndex(rank: Rank): number {
  if (rank === 'A') return 9
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 8
  if (rank === '10') return 8
  return parseInt(rank) - 2
}

// ─── Pair index ─────────────────────────────────────────────────────────────
function pairIndex(rank: Rank): number {
  if (rank === 'A') return 9
  const v = cardValue({ rank, suit: 'S', countValue: 0 } as Card)
  return v - 2
}

// ─── Resolve raw action to PlayerAction ─────────────────────────────────────
function resolveAction(
  raw: RawAction,
  canDbl: boolean,
  canSurr: boolean,
  canSpl: boolean,
): PlayerAction {
  switch (raw) {
    case 'H': return 'hit'
    case 'S': return 'stand'
    case 'D': return canDbl ? 'double' : 'hit'
    case 'Ds': return canDbl ? 'double' : 'stand'
    case 'P': return 'split'
    case 'Ph': return canSpl ? 'split' : 'hit'
    case 'Rh': return canSurr ? 'surrender' : 'hit'
    case 'Rs': return canSurr ? 'surrender' : 'stand'
    case 'Rp': return canSurr ? 'surrender' : 'split'
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the basic strategy recommendation for the given hand state.
 *
 * @param playerCards - The player's current cards
 * @param dealerUpcard - The dealer's face-up card
 * @param rules - Current rule configuration
 * @param isSplitHand - Whether this hand was created by splitting
 */
export function getBasicStrategyAction(
  playerCards: Card[],
  dealerUpcard: Card,
  rules: RuleConfig,
  isSplitHand = false,
): PlayerAction {
  const total = handTotal(playerCards)
  const soft = isSoft(playerCards)
  const dIdx = dealerIndex(dealerUpcard.rank)
  const isH17 = rules.dealerHitsSoft17
  const hasTwoCards = playerCards.length === 2
  const canDbl = hasTwoCards && (!isSplitHand || rules.doubleAfterSplit)
  const canSurr = rules.surrenderAllowed && hasTwoCards && !isSplitHand
  const canSpl = hasTwoCards && !isSplitHand &&
    cardValue(playerCards[0]!) === cardValue(playerCards[1]!)

  // Pair check — only on initial 2 cards with same value, not after split
  if (canSpl) {
    const pIdx = pairIndex(playerCards[0]!.rank)
    const key = `${pIdx}-${dIdx}`
    let raw = PAIRS_H17_DAS[pIdx]![dIdx]!

    // Apply no-DAS overrides
    if (!rules.doubleAfterSplit && PAIRS_NO_DAS_OVERRIDES[key]) {
      raw = PAIRS_NO_DAS_OVERRIDES[key]!
    }

    // Apply S17 overrides
    if (!isH17 && PAIRS_S17_OVERRIDES[key]) {
      raw = PAIRS_S17_OVERRIDES[key]!
    }

    const resolved = resolveAction(raw, canDbl, canSurr, true)
    // If resolved to split, return it. Otherwise fall through to hard/soft.
    if (resolved === 'split') return 'split'
    // For non-split results (e.g. 5,5 → double/hit), fall through.
  }

  // Soft hand check
  if (soft && total >= 13 && total <= 21) {
    const sIdx = total - 13
    const key = `${total}-${dealerUpcard.rank}`
    let raw = SOFT_H17[sIdx]![dIdx]!

    // Apply S17 overrides
    if (!isH17 && SOFT_S17_OVERRIDES[key]) {
      raw = SOFT_S17_OVERRIDES[key]!
    }

    return resolveAction(raw, canDbl, canSurr, false)
  }

  // Hard hand
  if (total >= 5 && total <= 21) {
    const hIdx = total - 5
    const key = `${total}-${dealerUpcard.rank}`
    let raw = HARD_H17[hIdx]![dIdx]!

    // Apply S17 overrides
    if (!isH17 && HARD_S17_OVERRIDES[key]) {
      raw = HARD_S17_OVERRIDES[key]!
    }

    return resolveAction(raw, canDbl, canSurr, false)
  }

  // Fallback for total < 5 (shouldn't happen with valid hands)
  return 'hit'
}

/**
 * Checks if a player action matches basic strategy.
 */
export function isCorrectPlay(
  playerAction: PlayerAction,
  playerCards: Card[],
  dealerUpcard: Card,
  rules: RuleConfig,
  isSplitHand = false,
): boolean {
  return playerAction === getBasicStrategyAction(playerCards, dealerUpcard, rules, isSplitHand)
}
