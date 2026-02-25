import { describe, it, expect } from 'vitest'
import { handTotal, isSoft, isBust, isBlackjack, shouldDealerHit, cardValue } from './rules.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import type { Card } from '@/modules/domain/types.ts'
import type { Rank, Suit } from '@/modules/domain/enums.ts'

function card(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, countValue: getHiLoValue(rank) }
}

describe('cardValue', () => {
  it('returns face value for number cards', () => {
    expect(cardValue(card('2'))).toBe(2)
    expect(cardValue(card('9'))).toBe(9)
  })

  it('returns 10 for face cards', () => {
    expect(cardValue(card('J'))).toBe(10)
    expect(cardValue(card('Q'))).toBe(10)
    expect(cardValue(card('K'))).toBe(10)
    expect(cardValue(card('10'))).toBe(10)
  })

  it('returns 11 for ace', () => {
    expect(cardValue(card('A'))).toBe(11)
  })
})

describe('handTotal', () => {
  it('sums simple hands', () => {
    expect(handTotal([card('5'), card('7')])).toBe(12)
  })

  it('handles soft ace', () => {
    expect(handTotal([card('A'), card('6')])).toBe(17)
  })

  it('adjusts ace when bust', () => {
    expect(handTotal([card('A'), card('6'), card('8')])).toBe(15)
  })

  it('handles two aces', () => {
    expect(handTotal([card('A'), card('A')])).toBe(12) // 11+1
  })

  it('handles blackjack', () => {
    expect(handTotal([card('A'), card('K')])).toBe(21)
  })

  it('handles three aces', () => {
    expect(handTotal([card('A'), card('A'), card('A')])).toBe(13) // 11+1+1
  })
})

describe('isSoft', () => {
  it('identifies soft hands', () => {
    expect(isSoft([card('A'), card('6')])).toBe(true)
  })

  it('identifies hard hands', () => {
    expect(isSoft([card('10'), card('6')])).toBe(false)
  })

  it('ace becomes hard when forced', () => {
    expect(isSoft([card('A'), card('6'), card('8')])).toBe(false) // 15 hard
  })
})

describe('isBust', () => {
  it('identifies bust', () => {
    expect(isBust([card('10'), card('6'), card('8')])).toBe(true)
  })

  it('non-bust', () => {
    expect(isBust([card('10'), card('6'), card('5')])).toBe(false)
  })

  it('21 is not bust', () => {
    expect(isBust([card('10'), card('6'), card('5')])).toBe(false)
  })
})

describe('isBlackjack', () => {
  it('ace + 10 is blackjack', () => {
    expect(isBlackjack([card('A'), card('10')])).toBe(true)
    expect(isBlackjack([card('A'), card('K')])).toBe(true)
  })

  it('21 with 3+ cards is not blackjack', () => {
    expect(isBlackjack([card('7'), card('7'), card('7')])).toBe(false)
  })

  it('two non-21 cards are not blackjack', () => {
    expect(isBlackjack([card('5'), card('6')])).toBe(false)
  })
})

describe('shouldDealerHit', () => {
  const h17Rules = {
    decks: 6 as const,
    dealerHitsSoft17: true,
    doubleAfterSplit: true,
    surrenderAllowed: false,
    penetration: 0.75,
    dealSpeed: 'normal' as const,
  }

  const s17Rules = { ...h17Rules, dealerHitsSoft17: false }

  it('hits on 16', () => {
    expect(shouldDealerHit([card('10'), card('6')], h17Rules)).toBe(true)
  })

  it('stands on hard 17', () => {
    expect(shouldDealerHit([card('10'), card('7')], h17Rules)).toBe(false)
  })

  it('hits soft 17 with H17 rule', () => {
    expect(shouldDealerHit([card('A'), card('6')], h17Rules)).toBe(true)
  })

  it('stands soft 17 with S17 rule', () => {
    expect(shouldDealerHit([card('A'), card('6')], s17Rules)).toBe(false)
  })

  it('stands on 18', () => {
    expect(shouldDealerHit([card('10'), card('8')], h17Rules)).toBe(false)
  })
})
