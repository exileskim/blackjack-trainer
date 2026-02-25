import type { Card, Hand, RuleConfig } from '@/modules/domain/types.ts'

export function cardValue(card: Card): number {
  if (card.rank === 'A') return 11
  if (['K', 'Q', 'J', '10'].includes(card.rank)) return 10
  return parseInt(card.rank)
}

export function handTotal(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of cards) {
    const val = cardValue(card)
    total += val
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

export function isSoft(cards: Card[]): boolean {
  let total = 0
  let aces = 0
  for (const card of cards) {
    const val = cardValue(card)
    total += val
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 1) {
    total -= 10
    aces--
  }
  return aces > 0 && total <= 21
}

export function isBust(cards: Card[]): boolean {
  return handTotal(cards) > 21
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21
}

export function canSplit(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false
  if (hand.isSplit) return false // no re-splitting in MVP
  return cardValue(hand.cards[0]!) === cardValue(hand.cards[1]!)
}

export function canDouble(hand: Hand): boolean {
  return hand.cards.length === 2 && !hand.isDoubled
}

export function canDoubleAfterSplit(hand: Hand, rules: RuleConfig): boolean {
  if (!rules.doubleAfterSplit) return false
  return hand.isSplit && hand.cards.length === 2
}

export function canSurrender(hand: Hand, rules: RuleConfig): boolean {
  return rules.surrenderAllowed && hand.cards.length === 2 && !hand.isSplit
}

export function shouldDealerHit(dealerCards: Card[], rules: RuleConfig): boolean {
  const total = handTotal(dealerCards)
  if (total < 17) return true
  if (total === 17 && isSoft(dealerCards) && rules.dealerHitsSoft17) return true
  return false
}
