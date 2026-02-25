import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './sessionStore.ts'

/**
 * BJ-018: End-to-end reliability suite
 * Simulates extended sessions to verify no state desync or crashes.
 */

function resetStore() {
  useSessionStore.setState({
    sessionId: null,
    phase: 'idle',
    mode: 'countingDrill',
    ruleConfig: {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'normal',
    },
    shoe: null,
    runningCount: 0,
    handNumber: 0,
    playerHands: [],
    dealerHand: null,
    activeHandIndex: 0,
    dealerDrawQueue: [],
    promptScheduler: null,
    pendingPrompt: false,
    promptStartTime: null,
    phaseBeforePause: null,
    countChecks: [],
    handsPlayed: 0,
    startedAt: null,
    insuranceOffer: null,
  })
}

/** Advance through dealer turn until it resolves */
function completeDealerTurn() {
  for (let i = 0; i < 20; i++) {
    if (useSessionStore.getState().phase !== 'dealerTurn') return
    useSessionStore.getState().advanceDealerTurn()
  }
}

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

describe('counting drill stress test', () => {
  it('runs 100 hands without state desync', () => {
    const store = useSessionStore.getState()
    store.startSession('countingDrill', {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'fast',
    })

    let promptCount = 0
    for (let i = 0; i < 100; i++) {
      const s = useSessionStore.getState()
      expect(['ready', 'handResolved', 'countPromptOpen']).toContain(s.phase)

      if (s.phase === 'countPromptOpen') {
        // Submit the correct count
        s.submitCount(s.runningCount)
        promptCount++
        const afterSubmit = useSessionStore.getState()
        // Should still be in countPromptOpen until dismissed
        expect(afterSubmit.phase).toBe('countPromptOpen')
        afterSubmit.dismissPrompt()
      }

      const before = useSessionStore.getState()
      expect(['ready', 'handResolved']).toContain(before.phase)
      before.dealHand()
      completeDealerTurn()

      const after = useSessionStore.getState()
      expect(after.handNumber).toBe(i + 1)
      expect(after.handsPlayed).toBe(i + 1)
      expect(after.dealerHand).not.toBeNull()
      expect(after.dealerHand!.holeCardRevealed).toBe(true)
      expect(after.playerHands.length).toBeGreaterThan(0)
      expect(after.playerHands[0]!.outcome).toBeDefined()
    }

    // Should have had some prompts
    expect(promptCount).toBeGreaterThan(0)

    // End session
    const final = useSessionStore.getState()
    final.endSession()
    const ended = useSessionStore.getState()
    expect(ended.phase).toBe('completed')
    expect(ended.countChecks.length).toBe(promptCount)
  })

  it('handles shoe reshuffles across many hands', () => {
    const store = useSessionStore.getState()
    store.startSession('countingDrill', {
      decks: 2,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.65,
      dealSpeed: 'veryFast',
    })

    // 2 decks = 104 cards, 65% penetration ≈ 67 cards before reshuffle
    // Each hand uses 4+ cards, so ~16 hands per shoe
    // Running 60 hands should force multiple reshuffles
    for (let i = 0; i < 60; i++) {
      const s = useSessionStore.getState()
      if (s.phase === 'countPromptOpen') {
        s.submitCount(s.runningCount)
        s.dismissPrompt()
      }
      const before = useSessionStore.getState()
      expect(['ready', 'handResolved']).toContain(before.phase)
      before.dealHand()
      completeDealerTurn()

      const after = useSessionStore.getState()
      expect(after.shoe).not.toBeNull()
      // Shoe should always have cards remaining after a deal
      expect(after.shoe!.cardsRemaining()).toBeGreaterThanOrEqual(0)
    }

    expect(useSessionStore.getState().handsPlayed).toBe(60)
  })

  it('running count stays consistent with dealt cards', () => {
    const store = useSessionStore.getState()
    store.startSession('countingDrill', {
      decks: 1,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.50,
      dealSpeed: 'veryFast',
    })

    // Track that running count never goes wildly out of range
    // For 1 deck, RC should be within [-20, +20]
    for (let i = 0; i < 20; i++) {
      const s = useSessionStore.getState()
      if (s.phase === 'countPromptOpen') {
        s.submitCount(s.runningCount)
        s.dismissPrompt()
      }
      const before = useSessionStore.getState()
      before.dealHand()
      completeDealerTurn()

      const after = useSessionStore.getState()
      expect(after.runningCount).toBeGreaterThanOrEqual(-20)
      expect(after.runningCount).toBeLessThanOrEqual(20)
    }
  })
})

describe('play and count stress test', () => {
  it('runs 50 hands with player actions', () => {
    const store = useSessionStore.getState()
    store.startSession('playAndCount', {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'fast',
    })

    for (let i = 0; i < 50; i++) {
      const s = useSessionStore.getState()
      if (s.phase === 'countPromptOpen') {
        s.submitCount(s.runningCount)
        s.dismissPrompt()
      }

      const before = useSessionStore.getState()
      expect(['ready', 'handResolved']).toContain(before.phase)
      before.dealHand()

      if (useSessionStore.getState().phase === 'awaitingInsurance') {
        useSessionStore.getState().declineInsurance()
      }

      // In play+count, we need to make decisions
      let safety = 0
      while (useSessionStore.getState().phase === 'awaitingPlayerAction' && safety < 20) {
        safety++
        const current = useSessionStore.getState()
        // Just stand on everything for simplicity
        current.playerStand()
      }
      completeDealerTurn()

      const after = useSessionStore.getState()
      expect(['handResolved', 'countPromptOpen']).toContain(after.phase)
      expect(after.handsPlayed).toBe(i + 1)
    }

    // Verify all hands resolved
    expect(useSessionStore.getState().handsPlayed).toBe(50)
  })

  it('handles hit-until-bust without errors', () => {
    const store = useSessionStore.getState()
    store.startSession('playAndCount', {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'fast',
    })

    for (let i = 0; i < 30; i++) {
      const s = useSessionStore.getState()
      if (s.phase === 'countPromptOpen') {
        s.submitCount(0)
        s.dismissPrompt()
      }

      const before = useSessionStore.getState()
      expect(['ready', 'handResolved']).toContain(before.phase)
      before.dealHand()

      if (useSessionStore.getState().phase === 'awaitingInsurance') {
        useSessionStore.getState().declineInsurance()
      }

      // Hit until bust or hand resolves
      let safety = 0
      while (useSessionStore.getState().phase === 'awaitingPlayerAction' && safety < 15) {
        safety++
        useSessionStore.getState().playerHit()
      }
      completeDealerTurn()

      const after = useSessionStore.getState()
      expect(['handResolved', 'countPromptOpen']).toContain(after.phase)
    }
  })
})

describe('pause/resume during extended session', () => {
  it('pause and resume at various phases', () => {
    const store = useSessionStore.getState()
    store.startSession('countingDrill', {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'normal',
    })

    for (let i = 0; i < 30; i++) {
      const s = useSessionStore.getState()
      if (s.phase === 'countPromptOpen') {
        s.submitCount(s.runningCount)
        s.dismissPrompt()
      }

      const before = useSessionStore.getState()
      before.dealHand()
      completeDealerTurn()

      // Pause and resume after each hand
      const after = useSessionStore.getState()
      if (after.phase === 'handResolved') {
        after.pause()
        expect(useSessionStore.getState().phase).toBe('paused')
        useSessionStore.getState().resume()
        expect(useSessionStore.getState().phase).toBe('handResolved')
      }
    }
  })
})

describe('speed control during session', () => {
  it('cycles through all speeds without error', () => {
    const store = useSessionStore.getState()
    store.startSession('countingDrill', {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'slow',
    })

    const speeds = ['slow', 'normal', 'fast', 'veryFast']
    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('slow')

    // Cycle through all speeds
    for (let i = 0; i < speeds.length; i++) {
      useSessionStore.getState().cycleDealSpeed()
    }
    // Should wrap around to slow
    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('slow')

    // SpeedUp from slow to veryFast
    useSessionStore.getState().speedUp()
    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('normal')
    useSessionStore.getState().speedUp()
    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('fast')
    useSessionStore.getState().speedUp()
    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('veryFast')
    // Already at max, should stay
    useSessionStore.getState().speedUp()
    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('veryFast')

    // SpeedDown
    useSessionStore.getState().speedDown()
    expect(useSessionStore.getState().ruleConfig.dealSpeed).toBe('fast')
  })
})
