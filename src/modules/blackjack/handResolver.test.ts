import { describe, it, expect } from 'vitest'
import { resolveOutcome } from './handResolver.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import type { Card } from '@/modules/domain/types.ts'
import type { Rank } from '@/modules/domain/enums.ts'

function card(rank: Rank): Card {
  return { rank, suit: 'S', countValue: getHiLoValue(rank) }
}

describe('resolveOutcome', () => {
  it('player blackjack wins', () => {
    expect(resolveOutcome([card('A'), card('K')], [card('10'), card('8')])).toBe('blackjack')
  })

  it('dealer blackjack wins', () => {
    expect(resolveOutcome([card('10'), card('8')], [card('A'), card('K')])).toBe('loss')
  })

  it('both blackjack is push', () => {
    expect(resolveOutcome([card('A'), card('K')], [card('A'), card('Q')])).toBe('push')
  })

  it('player bust loses', () => {
    expect(resolveOutcome([card('10'), card('6'), card('8')], [card('10'), card('7')])).toBe('loss')
  })

  it('dealer bust wins', () => {
    expect(resolveOutcome([card('10'), card('7')], [card('10'), card('6'), card('8')])).toBe('win')
  })

  it('higher total wins', () => {
    expect(resolveOutcome([card('10'), card('9')], [card('10'), card('8')])).toBe('win')
  })

  it('lower total loses', () => {
    expect(resolveOutcome([card('10'), card('7')], [card('10'), card('9')])).toBe('loss')
  })

  it('equal totals push', () => {
    expect(resolveOutcome([card('10'), card('8')], [card('10'), card('8')])).toBe('push')
  })
})
