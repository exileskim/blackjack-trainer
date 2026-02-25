import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SessionPhase, TrainingMode, PromptType, PlayerAction } from '@/modules/domain/enums.ts'
import { DEAL_SPEEDS, PROMPT_TYPES } from '@/modules/domain/enums.ts'
import type { Card, RuleConfig, CountCheck, Hand, DealerHand } from '@/modules/domain/types.ts'
import {
  saveActiveSession,
  clearActiveSession,
  saveSessionRecord,
  saveSettings,
  loadSettings,
  type SessionSnapshot,
  type SessionRecord,
} from '@/modules/persistence/repository.ts'
import { createShoe, createShoeFromState, type Shoe } from '@/modules/blackjack/shoe.ts'
import { updateRunningCountSingle } from '@/modules/counting/hiLo.ts'
import {
  canDouble,
  canDoubleAfterSplit,
  canSplit,
  canSurrender,
  isBlackjack,
  isBust,
  shouldDealerHit,
} from '@/modules/blackjack/rules.ts'
import { resolveOutcome } from '@/modules/blackjack/handResolver.ts'
import {
  createPromptScheduler,
  createPromptSchedulerFromState,
  type PromptScheduler,
} from '@/modules/prompts/promptScheduler.ts'
import { DEFAULT_ACCESSIBILITY_SETTINGS } from '@/modules/accessibility/settings.ts'
import { recentMissRate } from '@/modules/stats/weakSpotAnalyzer.ts'
import { getBasicStrategyAction } from '@/modules/strategy/basicStrategy.ts'
import { getDeviationAction } from '@/modules/strategy/deviations.ts'
import { computeTrueCount, estimateDecksRemaining } from '@/modules/counting/trueCount.ts'
import { assertTransition } from './sessionMachine.ts'

/** Feedback from the strategy coach after a player action */
export interface ActionFeedback {
  readonly chosenAction: PlayerAction
  readonly recommendedAction: PlayerAction
  readonly isCorrect: boolean
  readonly deviationName: string | null
}

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

  // Dealer turn queue — cards pre-drawn, revealed one at a time
  dealerDrawQueue: Card[]

  // Prompt state
  promptScheduler: PromptScheduler | null
  pendingPrompt: boolean
  promptStartTime: number | null

  // Pause state
  phaseBeforePause: SessionPhase | null

  // Stats
  countChecks: CountCheck[]
  handsPlayed: number

  // Session start timestamp
  startedAt: string | null

  // Strategy coach state
  lastActionFeedback: ActionFeedback | null
  strategyCoachEnabled: boolean
  strategyDecisionLog: ActionFeedback[]

  // Prompt types (BJ-036)
  enabledPromptTypes: PromptType[]
  activePromptType: PromptType | null
  promptExpectedAction: PlayerAction | null

  // Actions
  startSession: (mode: TrainingMode, rules: RuleConfig) => void
  dealHand: () => void
  advanceDealerTurn: () => void
  playerHit: () => void
  playerStand: () => void
  playerDouble: () => void
  playerSplit: () => void
  playerSurrender: () => void
  submitCount: (enteredCount: number) => void
  submitBestAction: (enteredAction: PlayerAction) => void
  dismissPrompt: () => void
  pause: () => void
  resume: () => void
  endSession: () => void
  resetToIdle: () => void
  cycleDealSpeed: () => void
  speedUp: () => void
  speedDown: () => void
  restoreSession: (snapshot: SessionSnapshot) => void
  toggleStrategyCoach: () => void
  togglePromptType: (type: PromptType) => void
}

const persistedSettings = loadSettings()
const initialPromptTypes = normalizeEnabledPromptTypes(persistedSettings?.enabledPromptTypes)

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  phase: 'idle',
  mode: 'playAndCount',
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
  lastActionFeedback: null,
  strategyCoachEnabled: true,
  strategyDecisionLog: [],
  enabledPromptTypes: initialPromptTypes,
  activePromptType: null,
  promptExpectedAction: null,

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
      dealerDrawQueue: [],
      promptScheduler: scheduler,
      pendingPrompt: false,
      promptStartTime: null,
      phaseBeforePause: null,
      countChecks: [],
      handsPlayed: 0,
      startedAt: new Date().toISOString(),
      lastActionFeedback: null,
      strategyDecisionLog: [],
      promptExpectedAction: null,
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
      // In counting drill mode or player BJ, enter dealer turn sequence.
      // Reveal hole card immediately and pre-compute dealer draws.
      rc = updateRunningCountSingle(rc, dHole)

      // Pre-compute dealer draw queue
      const drawQueue: Card[] = []
      const dealerBj = isBlackjack(dealerHand.cards)
      if (!playerBj && !dealerBj) {
        const tempCards = [...dealerHand.cards]
        while (shouldDealerHit(tempCards, state.ruleConfig)) {
          const card = shoe.drawCard()
          drawQueue.push(card)
          tempCards.push(card)
        }
      }

      assertTransition('dealing', 'dealerTurn')
      set({
        phase: 'dealerTurn',
        handNumber: handNum,
        runningCount: rc,
        playerHands: [playerHand],
        dealerHand: { ...dealerHand, holeCardRevealed: true },
        activeHandIndex: 0,
        dealerDrawQueue: drawQueue,
        promptExpectedAction: null,
      })
    } else {
      const recommended = getRecommendedAction(
        playerHand.cards,
        dealerHand.cards[0]!,
        state.ruleConfig,
        rc,
        shoe,
        false,
      )

      // Play + Count mode: wait for player actions
      set({
        phase: 'awaitingPlayerAction',
        handNumber: handNum,
        runningCount: rc,
        playerHands: [playerHand],
        dealerHand,
        activeHandIndex: 0,
        lastActionFeedback: null,
        promptExpectedAction: recommended.action,
      })
    }
  },

  advanceDealerTurn() {
    const state = get()
    if (state.phase !== 'dealerTurn') return

    const queue = [...state.dealerDrawQueue]
    const dealerHand = state.dealerHand!

    if (queue.length === 0) {
      // Dealer done drawing — resolve outcomes
      const resolvedHands = state.playerHands.map((h) => {
        if (h.outcome) return h
        return { ...h, outcome: resolveOutcome(h.cards, dealerHand.cards) }
      })

      const scheduler = state.promptScheduler!
      const eligiblePromptTypes = state.enabledPromptTypes.filter((type) => {
        if (type !== 'bestAction') return true
        return state.mode === 'playAndCount' && state.promptExpectedAction !== null
      })
      const shouldPrompt = scheduler.onHandResolved() && eligiblePromptTypes.length > 0
      const newPlayed = state.handsPlayed + 1
      const nextPhase = shouldPrompt ? 'countPromptOpen' : 'handResolved'
      assertTransition('dealerTurn', nextPhase)

      // Pick a random prompt type from eligible types
      const promptType = shouldPrompt
        ? eligiblePromptTypes[Math.floor(Math.random() * eligiblePromptTypes.length)]!
        : null

      set({
        phase: nextPhase,
        playerHands: resolvedHands,
        handsPlayed: newPlayed,
        dealerDrawQueue: [],
        pendingPrompt: shouldPrompt,
        promptStartTime: shouldPrompt ? Date.now() : null,
        activePromptType: promptType,
        promptExpectedAction:
          promptType === 'bestAction' ? state.promptExpectedAction : null,
      })

      // Autosave after every resolved hand
      const updated = get()
      if (updated.sessionId && updated.shoe && updated.promptScheduler) {
        saveActiveSession({
          sessionId: updated.sessionId,
          phase: updated.phase,
          mode: updated.mode,
          ruleConfig: updated.ruleConfig,
          runningCount: updated.runningCount,
          handNumber: updated.handNumber,
          handsPlayed: newPlayed,
          countChecks: updated.countChecks,
          pendingPrompt: updated.pendingPrompt,
          promptStartTime: updated.promptStartTime,
          activePromptType: updated.activePromptType,
          promptExpectedAction: updated.promptExpectedAction,
          shoeState: updated.shoe.serialize(),
          schedulerState: updated.promptScheduler.serialize(),
          startedAt: updated.startedAt ?? new Date().toISOString(),
          savedAt: new Date().toISOString(),
        })
      }
    } else {
      // Reveal next dealer card
      const [nextCard, ...remaining] = queue
      const rc = updateRunningCountSingle(state.runningCount, nextCard!)
      const updatedDealer: DealerHand = {
        cards: [...dealerHand.cards, nextCard!],
        holeCardRevealed: true,
      }

      set({
        dealerHand: updatedDealer,
        dealerDrawQueue: remaining,
        runningCount: rc,
      })
    }
  },

  playerHit() {
    const state = get()
    if (state.phase !== 'awaitingPlayerAction') return
    assertTransition('awaitingPlayerAction', 'dealing')

    const shoe = state.shoe!
    const activeHand = state.playerHands[state.activeHandIndex]!

    // Compute strategy feedback before action
    const feedback = state.mode === 'playAndCount' && state.dealerHand
      ? computeStrategyFeedback('hit', activeHand.cards, state.dealerHand.cards[0]!, state.ruleConfig, state.runningCount, shoe, activeHand.isSplit)
      : null

    const card = shoe.drawCard()
    const rc = updateRunningCountSingle(state.runningCount, card)

    const hands = [...state.playerHands]
    if (activeHand.outcome) return
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
    if (feedback) {
      set({
        lastActionFeedback: feedback,
        strategyDecisionLog: [...get().strategyDecisionLog, feedback],
      })
    }
  },

  playerStand() {
    const state = get()
    if (state.phase !== 'awaitingPlayerAction') return
    assertTransition('awaitingPlayerAction', 'dealing')

    const activeHand = state.playerHands[state.activeHandIndex]!

    // Compute strategy feedback
    const feedback = state.mode === 'playAndCount' && state.dealerHand
      ? computeStrategyFeedback('stand', activeHand.cards, state.dealerHand.cards[0]!, state.ruleConfig, state.runningCount, state.shoe!, activeHand.isSplit)
      : null

    const hands = [...state.playerHands]
    if (activeHand.outcome) return
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
    if (feedback) {
      set({
        lastActionFeedback: feedback,
        strategyDecisionLog: [...get().strategyDecisionLog, feedback],
      })
    }
  },

  playerDouble() {
    const state = get()
    if (state.phase !== 'awaitingPlayerAction') return
    assertTransition('awaitingPlayerAction', 'dealing')

    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!
    if (activeHand.outcome) return
    const canDoubleThisHand =
      canDouble(activeHand) &&
      (!activeHand.isSplit || canDoubleAfterSplit(activeHand, state.ruleConfig))
    if (!canDoubleThisHand) return

    // Compute strategy feedback
    const feedback = state.mode === 'playAndCount' && state.dealerHand
      ? computeStrategyFeedback('double', activeHand.cards, state.dealerHand.cards[0]!, state.ruleConfig, state.runningCount, state.shoe!, activeHand.isSplit)
      : null

    const shoe = state.shoe!
    const card = shoe.drawCard()
    const rc = updateRunningCountSingle(state.runningCount, card)
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
    if (feedback) {
      set({
        lastActionFeedback: feedback,
        strategyDecisionLog: [...get().strategyDecisionLog, feedback],
      })
    }
  },

  playerSplit() {
    const state = get()
    if (state.phase !== 'awaitingPlayerAction') return
    assertTransition('awaitingPlayerAction', 'dealing')

    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!
    if (activeHand.outcome || !canSplit(activeHand)) return

    // Compute strategy feedback
    const feedback = state.mode === 'playAndCount' && state.dealerHand
      ? computeStrategyFeedback('split', activeHand.cards, state.dealerHand.cards[0]!, state.ruleConfig, state.runningCount, state.shoe!, activeHand.isSplit)
      : null

    const shoe = state.shoe!

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
    if (feedback) {
      set({
        lastActionFeedback: feedback,
        strategyDecisionLog: [...get().strategyDecisionLog, feedback],
      })
    }
  },

  playerSurrender() {
    const state = get()
    if (state.phase !== 'awaitingPlayerAction') return
    assertTransition('awaitingPlayerAction', 'dealing')

    const hands = [...state.playerHands]
    const activeHand = hands[state.activeHandIndex]!
    if (activeHand.outcome || !canSurrender(activeHand, state.ruleConfig)) return

    // Compute strategy feedback
    const feedback = state.mode === 'playAndCount' && state.dealerHand
      ? computeStrategyFeedback('surrender', activeHand.cards, state.dealerHand.cards[0]!, state.ruleConfig, state.runningCount, state.shoe!, activeHand.isSplit)
      : null

    hands[state.activeHandIndex] = {
      ...activeHand,
      outcome: 'surrender',
      playerDecisionLog: [...activeHand.playerDecisionLog, 'surrender'],
    }

    finishHand(set, get, hands, state.runningCount)
    if (feedback) {
      set({
        lastActionFeedback: feedback,
        strategyDecisionLog: [...get().strategyDecisionLog, feedback],
      })
    }
  },

  submitCount(enteredCount: number) {
    const state = get()
    if (state.phase !== 'countPromptOpen') return
    if (state.activePromptType === 'bestAction') return

    // Determine expected value based on prompt type
    let expected: number
    if (state.activePromptType === 'trueCount') {
      const decksRemaining = estimateDecksRemaining(state.shoe!.cardsRemaining())
      expected = computeTrueCount(state.runningCount, decksRemaining)
    } else {
      expected = state.runningCount
    }

    const delta = enteredCount - expected
    const responseMs = state.promptStartTime ? Date.now() - state.promptStartTime : 0

    const check: CountCheck = {
      sessionId: state.sessionId!,
      handNumber: state.handNumber,
      promptType: state.activePromptType ?? 'runningCount',
      expectedCount: expected,
      enteredCount,
      responseMs,
      isCorrect: delta === 0,
      delta,
      createdAt: new Date().toISOString(),
    }

    persistPromptCheck(set, get, check)
  },

  submitBestAction(enteredAction: PlayerAction) {
    const state = get()
    if (state.phase !== 'countPromptOpen') return
    if (state.activePromptType !== 'bestAction') return
    if (!state.promptExpectedAction) return

    const responseMs = state.promptStartTime ? Date.now() - state.promptStartTime : 0
    const check: CountCheck = {
      sessionId: state.sessionId!,
      handNumber: state.handNumber,
      promptType: 'bestAction',
      expectedCount: 0,
      enteredCount: 0,
      expectedAction: state.promptExpectedAction,
      enteredAction,
      responseMs,
      isCorrect: enteredAction === state.promptExpectedAction,
      delta: 0,
      createdAt: new Date().toISOString(),
    }

    persistPromptCheck(set, get, check)
  },

  dismissPrompt() {
    const state = get()
    if (state.phase !== 'countPromptOpen') return
    assertTransition('countPromptOpen', 'handResolved')
    set({
      phase: 'handResolved',
      pendingPrompt: false,
      promptStartTime: null,
      activePromptType: null,
      promptExpectedAction: null,
    })

    const updated = get()
    if (updated.sessionId && updated.shoe && updated.promptScheduler) {
      saveActiveSession({
        sessionId: updated.sessionId,
        phase: updated.phase,
        mode: updated.mode,
        ruleConfig: updated.ruleConfig,
        runningCount: updated.runningCount,
        handNumber: updated.handNumber,
        handsPlayed: updated.handsPlayed,
        countChecks: updated.countChecks,
        pendingPrompt: updated.pendingPrompt,
        promptStartTime: updated.promptStartTime,
        activePromptType: updated.activePromptType,
        promptExpectedAction: updated.promptExpectedAction,
        shoeState: updated.shoe.serialize(),
        schedulerState: updated.promptScheduler.serialize(),
        startedAt: updated.startedAt ?? new Date().toISOString(),
        savedAt: new Date().toISOString(),
      })
    }
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

    // Save to history
    if (state.sessionId && state.handsPlayed > 0) {
      const checks = state.countChecks
      const correct = checks.filter((c) => c.isCorrect).length
      let longestStreak = 0
      let streak = 0
      for (const c of checks) {
        if (c.isCorrect) { streak++; longestStreak = Math.max(longestStreak, streak) }
        else streak = 0
      }

      const record: SessionRecord = {
        sessionId: state.sessionId,
        mode: state.mode,
        ruleConfig: state.ruleConfig,
        startedAt: state.startedAt ?? new Date().toISOString(),
        endedAt: new Date().toISOString(),
        handsPlayed: state.handsPlayed,
        countChecks: checks,
        summary: {
          totalPrompts: checks.length,
          correctPrompts: correct,
          accuracy: checks.length > 0 ? (correct / checks.length) * 100 : 0,
          avgResponseMs: checks.length > 0
            ? checks.reduce((s, c) => s + c.responseMs, 0) / checks.length
            : 0,
          longestStreak,
        },
      }
      saveSessionRecord(record)
    }

    clearActiveSession()
    set({ phase: 'completed', pendingPrompt: false, promptStartTime: null })
  },

  resetToIdle() {
    clearActiveSession()
    set({
      sessionId: null,
      phase: 'idle',
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
      lastActionFeedback: null,
      strategyDecisionLog: [],
      activePromptType: null,
      promptExpectedAction: null,
    })
  },

  cycleDealSpeed() {
    const state = get()
    const idx = DEAL_SPEEDS.indexOf(state.ruleConfig.dealSpeed)
    const next = DEAL_SPEEDS[(idx + 1) % DEAL_SPEEDS.length]!
    const nextRuleConfig = { ...state.ruleConfig, dealSpeed: next }
    set({ ruleConfig: nextRuleConfig })
    const currentSettings = loadSettings()
    saveSettings({
      mode: state.mode,
      ruleConfig: nextRuleConfig,
      accessibility: currentSettings?.accessibility ?? DEFAULT_ACCESSIBILITY_SETTINGS,
      enabledPromptTypes: currentSettings?.enabledPromptTypes ?? state.enabledPromptTypes,
    })
  },

  speedUp() {
    const state = get()
    const idx = DEAL_SPEEDS.indexOf(state.ruleConfig.dealSpeed)
    if (idx < DEAL_SPEEDS.length - 1) {
      const nextRuleConfig = { ...state.ruleConfig, dealSpeed: DEAL_SPEEDS[idx + 1]! }
      set({ ruleConfig: nextRuleConfig })
      const currentSettings = loadSettings()
      saveSettings({
        mode: state.mode,
        ruleConfig: nextRuleConfig,
        accessibility: currentSettings?.accessibility ?? DEFAULT_ACCESSIBILITY_SETTINGS,
        enabledPromptTypes: currentSettings?.enabledPromptTypes ?? state.enabledPromptTypes,
      })
    }
  },

  speedDown() {
    const state = get()
    const idx = DEAL_SPEEDS.indexOf(state.ruleConfig.dealSpeed)
    if (idx > 0) {
      const nextRuleConfig = { ...state.ruleConfig, dealSpeed: DEAL_SPEEDS[idx - 1]! }
      set({ ruleConfig: nextRuleConfig })
      const currentSettings = loadSettings()
      saveSettings({
        mode: state.mode,
        ruleConfig: nextRuleConfig,
        accessibility: currentSettings?.accessibility ?? DEFAULT_ACCESSIBILITY_SETTINGS,
        enabledPromptTypes: currentSettings?.enabledPromptTypes ?? state.enabledPromptTypes,
      })
    }
  },

  restoreSession(snapshot) {
    const shoe = snapshot.shoeState
      ? createShoeFromState(snapshot.shoeState)
      : createShoe(snapshot.ruleConfig.decks, snapshot.ruleConfig.penetration)
    const scheduler = snapshot.schedulerState
      ? createPromptSchedulerFromState(snapshot.schedulerState)
      : createPromptScheduler()
    const restoredPhase =
      snapshot.phase === 'countPromptOpen' && !snapshot.pendingPrompt
        ? 'handResolved'
        : snapshot.phase
    const restoredPromptStartTime =
      restoredPhase === 'countPromptOpen' && snapshot.pendingPrompt
        ? Date.now()
        : null

    set({
      sessionId: snapshot.sessionId,
      phase: restoredPhase,
      mode: snapshot.mode,
      ruleConfig: snapshot.ruleConfig,
      shoe,
      runningCount: snapshot.runningCount,
      handNumber: snapshot.handNumber,
      playerHands: [],
      dealerHand: null,
      activeHandIndex: 0,
      dealerDrawQueue: [],
      promptScheduler: scheduler,
      pendingPrompt: restoredPhase === 'countPromptOpen' ? snapshot.pendingPrompt : false,
      promptStartTime: restoredPromptStartTime,
      phaseBeforePause: null,
      countChecks: snapshot.countChecks,
      handsPlayed: snapshot.handsPlayed,
      startedAt: snapshot.startedAt,
      activePromptType:
        restoredPhase === 'countPromptOpen'
          ? snapshot.activePromptType ?? 'runningCount'
          : null,
      promptExpectedAction:
        restoredPhase === 'countPromptOpen'
          ? snapshot.promptExpectedAction ?? null
          : null,
    })
  },

  toggleStrategyCoach() {
    set((s) => ({ strategyCoachEnabled: !s.strategyCoachEnabled }))
  },

  togglePromptType(type: PromptType) {
    const state = get()
    const current = state.enabledPromptTypes
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    // Must have at least one type enabled
    if (next.length === 0) return
    set({ enabledPromptTypes: next })
    const currentSettings = loadSettings()
    saveSettings({
      mode: state.mode,
      ruleConfig: state.ruleConfig,
      accessibility: currentSettings?.accessibility ?? DEFAULT_ACCESSIBILITY_SETTINGS,
      enabledPromptTypes: next,
    })
  },
}))

function normalizeEnabledPromptTypes(types: PromptType[] | undefined): PromptType[] {
  const normalized = (types ?? []).filter((t): t is PromptType =>
    (PROMPT_TYPES as readonly string[]).includes(t),
  )
  const unique = Array.from(new Set(normalized))
  return unique.length > 0 ? unique : ['runningCount']
}

function persistPromptCheck(
  set: (partial: Partial<SessionState>) => void,
  get: () => SessionState,
  check: CountCheck,
): void {
  const state = get()
  const updatedChecks = [...state.countChecks, check]
  state.promptScheduler!.adaptCadence(recentMissRate(updatedChecks))
  state.promptScheduler!.onPromptSubmitted()

  set({
    countChecks: updatedChecks,
    pendingPrompt: false,
    promptStartTime: null,
    promptExpectedAction: null,
  })

  const updated = get()
  if (updated.sessionId && updated.shoe && updated.promptScheduler) {
    saveActiveSession({
      sessionId: updated.sessionId,
      phase: updated.phase,
      mode: updated.mode,
      ruleConfig: updated.ruleConfig,
      runningCount: updated.runningCount,
      handNumber: updated.handNumber,
      handsPlayed: updated.handsPlayed,
      countChecks: updated.countChecks,
      pendingPrompt: updated.pendingPrompt,
      promptStartTime: updated.promptStartTime,
      activePromptType: updated.activePromptType,
      promptExpectedAction: updated.promptExpectedAction,
      shoeState: updated.shoe.serialize(),
      schedulerState: updated.promptScheduler.serialize(),
      startedAt: updated.startedAt ?? new Date().toISOString(),
      savedAt: new Date().toISOString(),
    })
  }
}

function getRecommendedAction(
  playerCards: Card[],
  dealerUpcard: Card,
  rules: RuleConfig,
  runningCount: number,
  shoe: Shoe,
  isSplitHand: boolean,
): { action: PlayerAction; deviationName: string | null } {
  const decksRemaining = estimateDecksRemaining(shoe.cardsRemaining())
  const trueCount = computeTrueCount(runningCount, decksRemaining)

  const devResult = getDeviationAction(playerCards, dealerUpcard, trueCount, rules, isSplitHand)
  if (devResult) {
    return { action: devResult.action, deviationName: devResult.deviation.name }
  }

  return {
    action: getBasicStrategyAction(playerCards, dealerUpcard, rules, isSplitHand),
    deviationName: null,
  }
}

/**
 * Helper: compute strategy feedback for a player action.
 * Checks deviations first (using true count), then falls back to basic strategy.
 */
function computeStrategyFeedback(
  chosenAction: PlayerAction,
  playerCards: Card[],
  dealerUpcard: Card,
  rules: RuleConfig,
  runningCount: number,
  shoe: Shoe,
  isSplitHand: boolean,
): ActionFeedback {
  const recommended = getRecommendedAction(
    playerCards,
    dealerUpcard,
    rules,
    runningCount,
    shoe,
    isSplitHand,
  )

  return {
    chosenAction,
    recommendedAction: recommended.action,
    isCorrect: chosenAction === recommended.action,
    deviationName: recommended.deviationName,
  }
}

/**
 * Helper: transition to dealer turn after player actions are done.
 * Reveals hole card, pre-computes draw queue, sets phase to 'dealerTurn'.
 * The UI calls advanceDealerTurn() on a timer to animate each card.
 */
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

  // Pre-compute dealer draw queue
  const drawQueue: Card[] = []
  if (hasLiveHand) {
    const tempCards = [...dealerHand.cards]
    while (shouldDealerHit(tempCards, state.ruleConfig)) {
      const card = shoe.drawCard()
      drawQueue.push(card)
      tempCards.push(card)
    }
  }

  assertTransition(state.phase, 'dealerTurn')
  set({
    phase: 'dealerTurn',
    playerHands: hands,
    dealerHand: { ...dealerHand, holeCardRevealed: true },
    dealerDrawQueue: drawQueue,
    runningCount: rc,
  })
}
