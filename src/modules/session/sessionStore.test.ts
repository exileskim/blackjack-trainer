import { beforeEach, describe, expect, it } from 'vitest'
import type { Card, Hand, RuleConfig } from '@/modules/domain/types.ts'
import type { Rank, Suit } from '@/modules/domain/enums.ts'
import type { PromptScheduler } from '@/modules/prompts/promptScheduler.ts'
import type { Shoe } from '@/modules/blackjack/shoe.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import { DEFAULT_RULES } from '@/modules/domain/types.ts'
import { createPromptScheduler } from '@/modules/prompts/promptScheduler.ts'
import { loadActiveSession, loadSettings, saveSettings } from '@/modules/persistence/repository.ts'
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
    getCadenceTier: () => 'normal' as const,
    adaptCadence: () => {},
    reset: () => {},
    serialize: () => ({ handsSincePrompt: 0, nextThreshold: 4, cadenceTier: 'normal' as const }),
  }
}

function shoeFromCards(cards: Card[], deckCount = 1): Shoe & { drawn: number } {
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
    serialize() {
      return {
        cards: [...queue],
        deckCount,
        penetration: 0.75,
      }
    },
    get drawn() {
      return drawn
    },
  }
}

/** Advance through the dealer turn until it resolves */
function completeDealerTurn() {
  for (let i = 0; i < 20; i++) {
    if (useSessionStore.getState().phase !== 'dealerTurn') return
    useSessionStore.getState().advanceDealerTurn()
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
    localStorage.clear()
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
    ], 6)

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
    // dealHand now enters dealerTurn; advance through draws
    completeDealerTurn()
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

  it('autosaves resolved hands with shoe and scheduler state', () => {
    const shoe = shoeFromCards([
      card('10'),
      card('6'),
      card('2'),
      card('5'),
      card('3'),
      card('4'),
    ], 6)
    const scheduler = createPromptScheduler(() => 0.3)

    useSessionStore.setState({
      sessionId: 'autosave-session',
      phase: 'ready',
      mode: 'countingDrill',
      ruleConfig: { ...DEFAULT_RULES },
      shoe,
      runningCount: 0,
      handNumber: 0,
      playerHands: [],
      dealerHand: null,
      activeHandIndex: 0,
      promptScheduler: scheduler,
      pendingPrompt: false,
      promptStartTime: null,
      phaseBeforePause: null,
      countChecks: [],
      handsPlayed: 0,
      startedAt: '2026-02-25T00:00:00.000Z',
    })

    useSessionStore.getState().dealHand()
    completeDealerTurn()
    const snapshot = loadActiveSession()

    expect(snapshot).not.toBeNull()
    expect(snapshot?.sessionId).toBe('autosave-session')
    expect(snapshot?.phase).toBe('handResolved')
    expect(snapshot?.handsPlayed).toBe(1)
    expect(snapshot?.pendingPrompt).toBe(false)
    expect(snapshot?.shoeState.deckCount).toBe(6)
    expect(snapshot?.schedulerState.nextThreshold).toBe(4)
    expect(snapshot?.schedulerState.handsSincePrompt).toBe(1)
  })

  it('restores from saved shoe/scheduler state and keeps draw order', () => {
    useSessionStore.getState().restoreSession({
      sessionId: 'restore-session',
      phase: 'countPromptOpen',
      mode: 'playAndCount',
      ruleConfig: { ...DEFAULT_RULES, decks: 1, penetration: 1 },
      runningCount: 7,
      handNumber: 12,
      handsPlayed: 12,
      countChecks: [],
      pendingPrompt: false,
      promptStartTime: null,
      shoeState: {
        cards: [card('2'), card('3'), card('4'), card('5')],
        deckCount: 1,
        penetration: 1,
      },
      schedulerState: {
        handsSincePrompt: 2,
        nextThreshold: 5,
        cadenceTier: 'normal',
      },
      startedAt: '2026-02-25T00:00:00.000Z',
      savedAt: '2026-02-25T00:10:00.000Z',
    })

    const restored = useSessionStore.getState()
    expect(restored.phase).toBe('handResolved')

    restored.dealHand()
    const afterDeal = useSessionStore.getState()

    expect(afterDeal.phase).toBe('awaitingPlayerAction')
    expect(afterDeal.playerHands[0]?.cards.map((c) => c.rank)).toEqual(['5', '3'])
    expect(afterDeal.dealerHand?.cards[0]?.rank).toBe('4')
    expect(afterDeal.runningCount).toBe(10)
  })

  it('persists in-session speed changes to saved settings', () => {
    saveSettings({
      mode: 'playAndCount',
      ruleConfig: { ...DEFAULT_RULES },
      enabledPromptTypes: ['runningCount', 'bestAction'],
    })

    setPlayState({
      mode: 'playAndCount',
      ruleConfig: { ...DEFAULT_RULES, dealSpeed: 'normal' },
    })

    useSessionStore.getState().speedUp()
    useSessionStore.getState().speedUp()
    const persisted = loadSettings()

    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('veryFast')
    expect(persisted?.mode).toBe('playAndCount')
    expect(persisted?.ruleConfig.dealSpeed).toBe('veryFast')
    expect(persisted?.enabledPromptTypes).toEqual(['runningCount', 'bestAction'])
  })

  it('records best-action prompts with action answers', () => {
    useSessionStore.setState({
      sessionId: 'best-action-session',
      phase: 'countPromptOpen',
      mode: 'playAndCount',
      ruleConfig: { ...DEFAULT_RULES },
      shoe: shoeFromCards([card('2')]),
      runningCount: 2,
      handNumber: 3,
      playerHands: [],
      dealerHand: { cards: [card('10'), card('6')], holeCardRevealed: true },
      activeHandIndex: 0,
      dealerDrawQueue: [],
      promptScheduler: schedulerStub(),
      pendingPrompt: true,
      promptStartTime: Date.now() - 150,
      phaseBeforePause: null,
      countChecks: [],
      handsPlayed: 3,
      activePromptType: 'bestAction',
      promptExpectedAction: 'stand',
    })

    useSessionStore.getState().submitBestAction('hit')
    const check = useSessionStore.getState().countChecks[0]

    expect(check).toBeDefined()
    expect(check?.promptType).toBe('bestAction')
    expect(check?.expectedAction).toBe('stand')
    expect(check?.enteredAction).toBe('hit')
    expect(check?.isCorrect).toBe(false)
  })
})
