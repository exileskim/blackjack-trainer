import type { Card, RuleConfig } from '@/modules/domain/types.ts'
import type { Rank, PlayerAction } from '@/modules/domain/enums.ts'
import { cardValue, handTotal, isSoft } from '@/modules/blackjack/rules.ts'

/**
 * BJ-033: Rule-aware basic strategy engine.
 *
 * Returns the optimal basic strategy action for a given hand/dealer/rules
 * combination. Strategy tables are based on standard multi-deck basic strategy
 * with adjustments for rule variations (H17/S17, DAS, surrender).
 */

// ─── Internal action codes ──────────────────────────────────────────────────
// These encode conditional actions that collapse to a PlayerAction based on
// what the player is actually allowed to do.
type RawAction =
  | 'H'   // hit
  | 'S'   // stand
  | 'D'   // double if allowed, else hit
  | 'Ds'  // double if allowed, else stand
  | 'P'   // split
  | 'Ph'  // split if DAS, else hit
  | 'Rh'  // surrender if allowed, else hit
  | 'Rs'  // surrender if allowed, else stand
  | 'Rp'  // surrender if allowed, else split

// ─── Dealer upcard index ────────────────────────────────────────────────────
// Maps dealer upcard rank to column index 0-9 in strategy tables.
// Column order: 2, 3, 4, 5, 6, 7, 8, 9, 10, A
function dealerIndex(rank: Rank): number {
  if (rank === 'A') return 9
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 8
  if (rank === '10') return 8
  return parseInt(rank) - 2
}

// ─── Hard totals table (H17 multi-deck) ─────────────────────────────────────
// Rows: player total 5-21 (index = total - 5)
// Cols: dealer 2,3,4,5,6,7,8,9,10,A
const HARD_H17: RawAction[][] = [
  /* 5  */ ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  /* 6  */ ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  /* 7  */ ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  /* 8  */ ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  /* 9  */ ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  /* 10 */ ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  /* 11 */ ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'],
  /* 12 */ ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  /* 13 */ ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  /* 14 */ ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  /* 15 */ ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'Rh'],
  /* 16 */ ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'Rh', 'Rh', 'Rh'],
  /* 17 */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'Rs'],
  /* 18 */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  /* 19 */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  /* 20 */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  /* 21 */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
]

// ─── S17 overrides for hard totals ──────────────────────────────────────────
// When dealer stands on soft 17, a few plays change (mostly vs Ace).
const HARD_S17_OVERRIDES: Record<string, RawAction> = {
  '11-A': 'D',   // still double
  '15-A': 'H',   // no surrender vs A when S17
  '17-A': 'S',   // stand (no surrender vs A when S17)
}

// ─── Soft totals table (H17 multi-deck) ─────────────────────────────────────
// Rows: soft total 13(A,2) through 21(A,10) — index = total - 13
const SOFT_H17: RawAction[][] = [
  /* A,2 (13) */ ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  /* A,3 (14) */ ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  /* A,4 (15) */ ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  /* A,5 (16) */ ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  /* A,6 (17) */ ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  /* A,7 (18) */ ['Ds', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  /* A,8 (19) */ ['S', 'S', 'S', 'S', 'Ds', 'S', 'S', 'S', 'S', 'S'],
  /* A,9 (20) */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  /* A,10(21) */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
]

// ─── S17 overrides for soft totals ──────────────────────────────────────────
const SOFT_S17_OVERRIDES: Record<string, RawAction> = {
  '18-A': 'S',  // stand instead of hit vs A when S17
  '19-6': 'S',  // stand instead of Ds vs 6 when S17
}

// ─── Pair splitting table (H17 multi-deck with DAS) ─────────────────────────
// Rows: pair value 2-A (index by card value: 2→0, ..., 10→8, A→9)
// 10-value pairs (10,J,Q,K) share row index 8.
const PAIRS_H17_DAS: RawAction[][] = [
  /* 2,2 */ ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  /* 3,3 */ ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  /* 4,4 */ ['H', 'H', 'H', 'Ph', 'Ph', 'H', 'H', 'H', 'H', 'H'],
  /* 5,5 */ ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  /* 6,6 */ ['Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
  /* 7,7 */ ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  /* 8,8 */ ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'Rp'],
  /* 9,9 */ ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
  /* T,T */ ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  /* A,A */ ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
]

// ─── No-DAS pair overrides ──────────────────────────────────────────────────
// When DAS is not allowed, some splits become hits.
// Keys: pairIndex-dealerIndex (pairIndex: 2→0, 3→1, 4→2, 6→4; dealerIndex: 2→0, 3→1)
const PAIRS_NO_DAS_OVERRIDES: Record<string, RawAction> = {
  '0-0': 'H', '0-1': 'H',   // 2,2 vs 2-3: hit instead of split
  '1-0': 'H', '1-1': 'H',   // 3,3 vs 2-3: hit
  '2-0': 'H', '2-1': 'H', '2-2': 'H', '2-3': 'H', '2-4': 'H', // 4,4: never split without DAS
  '4-0': 'H',                // 6,6 vs 2: hit
}

// ─── S17 pair overrides ─────────────────────────────────────────────────────
// Keys: pairIndex-dealerIndex (8→6 for 8s; A→9 for dealer Ace)
const PAIRS_S17_OVERRIDES: Record<string, RawAction> = {
  '6-9': 'P',  // Still split 8s vs A when S17
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
