import { beforeEach, describe, expect, it } from 'vitest'
import type { Card, Hand, RuleConfig } from '@/modules/domain/types.ts'
import type { Rank, Suit } from '@/modules/domain/enums.ts'
import type { PromptScheduler } from '@/modules/prompts/promptScheduler.ts'
import type { Shoe } from '@/modules/blackjack/shoe.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import { DEFAULT_RULES } from '@/modules/domain/types.ts'
import { useSessionStore } from './sessionStore.ts'

function card(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, countValue: getHiLoValue(rank) }
}

function schedulerStub(): PromptScheduler {
  return {
    onHandResolved: () => false,
    onPromptSubmitted: () => {},
    getHandsSincePrompt: () => 0,
    getNextThreshold: () => 4,
    reset: () => {},
  }
}

function shoeFromCards(cards: Card[]): Shoe & { drawn: number } {
  const queue = [...cards]
  const total = cards.length
  let drawn = 0

  return {
    drawCard() {
      const next = queue.shift()
      if (!next) throw new Error('No more cards in test shoe')
      drawn++
      return next
    },
    cardsRemaining() {
      return queue.length
    },
    totalCards() {
      return total
    },
    needsReshuffle() {
      return false
    },
    reshuffle() {
      throw new Error('reshuffle should not be called in this test')
    },
    get drawn() {
      return drawn
    },
  }
}

function setPlayState(overrides: Partial<ReturnType<typeof useSessionStore.getState>>) {
  const baseRules: RuleConfig = { ...DEFAULT_RULES }
  const baseHand: Hand = {
    cards: [card('10'), card('8')],
    playerDecisionLog: [],
    isSplit: false,
    isDoubled: false,
    bet: 1,
  }

  useSessionStore.setState({
    sessionId: 'test-session',
    phase: 'awaitingPlayerAction',
    mode: 'playAndCount',
    ruleConfig: baseRules,
    shoe: shoeFromCards([card('2')]),
    runningCount: 0,
    handNumber: 1,
    playerHands: [baseHand],
    dealerHand: { cards: [card('9'), card('7')], holeCardRevealed: false },
    activeHandIndex: 0,
    promptScheduler: schedulerStub(),
    pendingPrompt: false,
    promptStartTime: null,
    phaseBeforePause: null,
    countChecks: [],
    handsPlayed: 0,
    ...overrides,
  })
}

describe('sessionStore regressions', () => {
  beforeEach(() => {
    useSessionStore.getState().resetToIdle()
  })

  it('plays out dealer cards in counting drill when no blackjack is present', () => {
    // Deal order: p1, d1, p2, dHole, dealerHit1, dealerHit2
    // Dealer starts with 6 + 5 (11) and should draw to at least 17.
    const shoe = shoeFromCards([
      card('10'),
      card('6'),
      card('2'),
      card('5'),
      card('3'),
      card('4'),
    ])

    useSessionStore.setState({
      sessionId: 'counting-drill-session',
      phase: 'ready',
      mode: 'countingDrill',
      ruleConfig: { ...DEFAULT_RULES },
      shoe,
      runningCount: 0,
      handNumber: 0,
      playerHands: [],
      dealerHand: null,
      activeHandIndex: 0,
      promptScheduler: schedulerStub(),
      pendingPrompt: false,
      promptStartTime: null,
      phaseBeforePause: null,
      countChecks: [],
      handsPlayed: 0,
    })

    useSessionStore.getState().dealHand()
    const state = useSessionStore.getState()

    expect(state.dealerHand?.holeCardRevealed).toBe(true)
    expect(state.dealerHand?.cards.length).toBe(4)
    expect(state.runningCount).toBe(4)
    expect(state.phase).toBe('handResolved')
  })

  it('blocks double on split hand when DAS is disabled', () => {
    const shoe = shoeFromCards([card('K')])
    setPlayState({
      ruleConfig: { ...DEFAULT_RULES, doubleAfterSplit: false },
      shoe,
      playerHands: [
        {
          cards: [card('8'), card('3')],
          playerDecisionLog: [],
          isSplit: true,
          isDoubled: false,
          bet: 1,
        },
      ],
    })

    useSessionStore.getState().playerDouble()
    const state = useSessionStore.getState()

    expect(state.playerHands[0]?.cards.length).toBe(2)
    expect(state.playerHands[0]?.playerDecisionLog).toEqual([])
    expect(state.runningCount).toBe(0)
    expect(shoe.drawn).toBe(0)
  })

  it('blocks split when active hand is not splittable', () => {
    const shoe = shoeFromCards([card('A'), card('A')])
    setPlayState({
      shoe,
      playerHands: [
        {
          cards: [card('9'), card('8')],
          playerDecisionLog: [],
          isSplit: false,
          isDoubled: false,
          bet: 1,
        },
      ],
    })

    useSessionStore.getState().playerSplit()
    const state = useSessionStore.getState()

    expect(state.playerHands.length).toBe(1)
    expect(state.playerHands[0]?.isSplit).toBe(false)
    expect(shoe.drawn).toBe(0)
  })
})
