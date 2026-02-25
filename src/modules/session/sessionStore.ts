import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SessionPhase, TrainingMode } from '@/modules/domain/enums.ts'
import type { RuleConfig, CountCheck, Hand, DealerHand } from '@/modules/domain/types.ts'
import { createShoe, type Shoe } from '@/modules/blackjack/shoe.ts'
import { updateRunningCountSingle } from '@/modules/counting/hiLo.ts'
import { isBlackjack, isBust, shouldDealerHit } from '@/modules/blackjack/rules.ts'
import { resolveOutcome } from '@/modules/blackjack/handResolver.ts'
import { createPromptScheduler, type PromptScheduler } from '@/modules/prompts/promptScheduler.ts'
import { assertTransition } from './sessionMachine.ts'

export interface SessionState {
  // Session metadata
  sessionId: string | null
  phase: SessionPhase
  mode: TrainingMode
  ruleConfig: RuleConfig

  // Game state
  shoe: Shoe | null
  runningCount: number
  handNumber: number
  playerHands: Hand[]
  dealerHand: DealerHand | null
  activeHandIndex: number

  // Prompt state
  promptScheduler: PromptScheduler | null
  pendingPrompt: boolean
  promptStartTime: number | null

  // Pause state
  phaseBeforePause: SessionPhase | null

  // Stats
  countChecks: CountCheck[]
  handsPlayed: number

  // Actions
  startSession: (mode: TrainingMode, rules: RuleConfig) => void
  dealHand: () => void
  playerHit: () => void
  playerStand: () => void
  playerDouble: () => void
  playerSplit: () => void
  playerSurrender: () => void
  submitCount: (enteredCount: number) => void
  dismissPrompt: () => void
  pause: () => void
  resume: () => void
  endSession: () => void
  resetToIdle: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
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
  promptScheduler: null,
  pendingPrompt: false,
  promptStartTime: null,
  phaseBeforePause: null,
  countChecks: [],
  handsPlayed: 0,

  startSession(mode, rules) {
    const state = get()
    assertTransition(state.phase, 'ready')
    const shoe = createShoe(rules.decks, rules.penetration)
    const scheduler = createPromptScheduler()
    set({
      sessionId: uuidv4(),
      phase: 'ready',
      mode,
      ruleConfig: rules,
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
    })
  },

  dealHand() {
    const state = get()
    if (state.phase === 'ready') {
      assertTransition('ready', 'dealing')
    } else {
      assertTransition(state.phase, 'dealing')
    }

    const shoe = state.shoe!

    // Reshuffle if needed
    if (shoe.needsReshuffle()) {
      shoe.reshuffle()
      set({ runningCount: 0 })
    }

    let rc = state.phase === 'ready' ? 0 : get().runningCount
    const handNum = state.handNumber + 1

    // Deal: player card, dealer card, player card, dealer hole card
    const p1 = shoe.drawCard()
    rc = updateRunningCountSingle(rc, p1)
    const d1 = shoe.drawCard()
    rc = updateRunningCountSingle(rc, d1)
    const p2 = shoe.drawCard()
    rc = updateRunningCountSingle(rc, p2)
    const dHole = shoe.drawCard()
    // Hole card is NOT counted until revealed

    const playerHand: Hand = {
      cards: [p1, p2],
      playerDecisionLog: [],
      isSplit: false,
      isDoubled: false,
      bet: 1,
    }

    const dealerHand: DealerHand = {
      cards: [d1, dHole],
      holeCardRevealed: false,
    }

    // Check for player blackjack or dealer showing ace scenarios
    const playerBj = isBlackjack(playerHand.cards)

    if (state.mode === 'countingDrill' || playerBj) {
      // In counting drill mode, auto-resolve hands
      // Also auto-resolve if player has blackjack
      // Reveal hole card
      rc = updateRunningCountSingle(rc, dHole)

      // Dealer plays out if needed
      const dealerCards = [...dealerHand.cards]
      if (!playerBj || isBlackjack(dealerHand.cards)) {
        // No more dealer draws needed
      } else {
        while (shouldDealerHit(dealerCards, state.ruleConfig)) {
          const card = shoe.drawCard()
          dealerCards.push(card)
          rc = updateRunningCountSingle(rc, card)
        }
      }

      const outcome = resolveOutcome(playerHand.cards, dealerCards)
      const resolvedPlayerHand: Hand = { ...playerHand, outcome }
      const resolvedDealerHand: DealerHand = { cards: dealerCards, holeCardRevealed: true }

      // Check if prompt should fire
      const scheduler = state.promptScheduler!
      const shouldPrompt = scheduler.onHandResolved()

      set({
        phase: shouldPrompt ? 'countPromptOpen' : 'handResolved',
        handNumber: handNum,
        runningCount: rc,
        playerHands: [resolvedPlayerHand],
        dealerHand: resolvedDealerHand,
        activeHandIndex: 0,
        handsPlayed: state.handsPlayed + 1,
        pendingPrompt: shouldPrompt,
        promptStartTime: shouldPrompt ? Date.now() : null,
      })
    } else {
      // Play + Count mode: wait for player actions
      set({
        phase: 'awaitingPlayerAction',
        handNumber: handNum,
        runningCount: rc,
        playerHands: [playerHand],
        dealerHand,
        activeHandIndex: 0,
      })
    }
  },

  playerHit() {
    const state = get()
    assertTransition(state.phase, 'dealing')

    const shoe = state.shoe!
    const card = shoe.drawCard()
    let rc = updateRunningCountSingle(state.runningCount, card)

    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!
    const updatedHand: Hand = {
      ...activeHand,
      cards: [...activeHand.cards, card],
      playerDecisionLog: [...activeHand.playerDecisionLog, 'hit'],
    }
    hands[state.activeHandIndex] = updatedHand

    if (isBust(updatedHand.cards)) {
      const bustedHand: Hand = { ...updatedHand, outcome: 'loss' }
      hands[state.activeHandIndex] = bustedHand

      // Move to next hand or dealer turn
      if (state.activeHandIndex < hands.length - 1) {
        set({
          playerHands: hands,
          runningCount: rc,
          activeHandIndex: state.activeHandIndex + 1,
        })
      } else {
        // All hands done, resolve
        finishHand(set, get, hands, rc)
      }
    } else {
      set({
        phase: 'awaitingPlayerAction',
        playerHands: hands,
        runningCount: rc,
      })
    }
  },

  playerStand() {
    const state = get()

    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!
    hands[state.activeHandIndex] = {
      ...activeHand,
      playerDecisionLog: [...activeHand.playerDecisionLog, 'stand'],
    }

    if (state.activeHandIndex < hands.length - 1) {
      set({
        playerHands: hands,
        activeHandIndex: state.activeHandIndex + 1,
      })
    } else {
      finishHand(set, get, hands, state.runningCount)
    }
  },

  playerDouble() {
    const state = get()
    const shoe = state.shoe!
    const card = shoe.drawCard()
    let rc = updateRunningCountSingle(state.runningCount, card)

    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!
    const doubledHand: Hand = {
      ...activeHand,
      cards: [...activeHand.cards, card],
      playerDecisionLog: [...activeHand.playerDecisionLog, 'double'],
      isDoubled: true,
    }

    if (isBust(doubledHand.cards)) {
      hands[state.activeHandIndex] = { ...doubledHand, outcome: 'loss' }
    } else {
      hands[state.activeHandIndex] = doubledHand
    }

    if (state.activeHandIndex < hands.length - 1) {
      set({
        playerHands: hands,
        runningCount: rc,
        activeHandIndex: state.activeHandIndex + 1,
      })
    } else {
      finishHand(set, get, hands, rc)
    }
  },

  playerSplit() {
    const state = get()
    const shoe = state.shoe!
    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!

    const card1 = shoe.drawCard()
    const card2 = shoe.drawCard()
    let rc = updateRunningCountSingle(state.runningCount, card1)
    rc = updateRunningCountSingle(rc, card2)

    const hand1: Hand = {
      cards: [activeHand.cards[0]!, card1],
      playerDecisionLog: ['split'],
      isSplit: true,
      isDoubled: false,
      bet: 1,
    }
    const hand2: Hand = {
      cards: [activeHand.cards[1]!, card2],
      playerDecisionLog: [],
      isSplit: true,
      isDoubled: false,
      bet: 1,
    }

    hands.splice(state.activeHandIndex, 1, hand1, hand2)

    set({
      phase: 'awaitingPlayerAction',
      playerHands: hands,
      runningCount: rc,
      activeHandIndex: state.activeHandIndex,
    })
  },

  playerSurrender() {
    const state = get()
    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!
    hands[state.activeHandIndex] = {
      ...activeHand,
      outcome: 'surrender',
      playerDecisionLog: [...activeHand.playerDecisionLog, 'surrender'],
    }

    finishHand(set, get, hands, state.runningCount)
  },

  submitCount(enteredCount: number) {
    const state = get()
    if (state.phase !== 'countPromptOpen') return

    const expected = state.runningCount
    const delta = enteredCount - expected
    const responseMs = state.promptStartTime ? Date.now() - state.promptStartTime : 0

    const check: CountCheck = {
      sessionId: state.sessionId!,
      handNumber: state.handNumber,
      expectedCount: expected,
      enteredCount,
      responseMs,
      isCorrect: delta === 0,
      delta,
      createdAt: new Date().toISOString(),
    }

    state.promptScheduler!.onPromptSubmitted()

    set({
      countChecks: [...state.countChecks, check],
      pendingPrompt: false,
      promptStartTime: null,
    })
  },

  dismissPrompt() {
    const state = get()
    if (state.phase !== 'countPromptOpen') return
    assertTransition('countPromptOpen', 'handResolved')
    set({ phase: 'handResolved', pendingPrompt: false, promptStartTime: null })
  },

  pause() {
    const state = get()
    assertTransition(state.phase, 'paused')
    set({ phase: 'paused', phaseBeforePause: state.phase })
  },

  resume() {
    const state = get()
    if (state.phase !== 'paused' || !state.phaseBeforePause) return
    assertTransition('paused', state.phaseBeforePause)
    set({ phase: state.phaseBeforePause, phaseBeforePause: null })
  },

  endSession() {
    const state = get()
    if (state.phase === 'idle' || state.phase === 'completed') return
    set({ phase: 'completed', pendingPrompt: false, promptStartTime: null })
  },

  resetToIdle() {
    set({
      sessionId: null,
      phase: 'idle',
      shoe: null,
      runningCount: 0,
      handNumber: 0,
      playerHands: [],
      dealerHand: null,
      activeHandIndex: 0,
      promptScheduler: null,
      pendingPrompt: false,
      promptStartTime: null,
      phaseBeforePause: null,
      countChecks: [],
      handsPlayed: 0,
    })
  },
}))

/** Helper: finish the hand by running dealer logic and resolving outcomes */
function finishHand(
  set: (partial: Partial<SessionState>) => void,
  get: () => SessionState,
  hands: Hand[],
  runningCount: number,
) {
  const state = get()
  const shoe = state.shoe!
  const dealerHand = state.dealerHand!
  let rc = runningCount

  // Reveal hole card
  if (!dealerHand.holeCardRevealed) {
    rc = updateRunningCountSingle(rc, dealerHand.cards[1]!)
  }

  // Check if any player hands are still alive (not busted/surrendered)
  const hasLiveHand = hands.some((h) => !h.outcome)

  const dealerCards = [...dealerHand.cards]
  if (hasLiveHand) {
    while (shouldDealerHit(dealerCards, state.ruleConfig)) {
      const card = shoe.drawCard()
      dealerCards.push(card)
      rc = updateRunningCountSingle(rc, card)
    }
  }

  // Resolve each hand
  const resolvedHands = hands.map((h) => {
    if (h.outcome) return h // already resolved (bust/surrender)
    return { ...h, outcome: resolveOutcome(h.cards, dealerCards) }
  })

  const resolvedDealer: DealerHand = { cards: dealerCards, holeCardRevealed: true }

  // Check prompt
  const scheduler = state.promptScheduler!
  const shouldPrompt = scheduler.onHandResolved()

  set({
    phase: shouldPrompt ? 'countPromptOpen' : 'handResolved',
    playerHands: resolvedHands,
    dealerHand: resolvedDealer,
    runningCount: rc,
    handsPlayed: state.handsPlayed + 1,
    pendingPrompt: shouldPrompt,
    promptStartTime: shouldPrompt ? Date.now() : null,
  })
}
