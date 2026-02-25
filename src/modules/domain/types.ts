import type {
  Rank,
  Suit,
  HandOutcome,
  SessionPhase,
  TrainingMode,
  DealSpeed,
  PlayerAction,
  DeckCount,
  PromptType,
} from './enums.ts'

export interface Card {
  readonly rank: Rank
  readonly suit: Suit
  readonly countValue: -1 | 0 | 1
}

export interface Hand {
  readonly cards: Card[]
  readonly playerDecisionLog: PlayerAction[]
  readonly outcome?: HandOutcome
  readonly isSplit: boolean
  readonly isDoubled: boolean
  readonly bet: number
}

export interface DealerHand {
  readonly cards: Card[]
  readonly holeCardRevealed: boolean
}

export interface RuleConfig {
  readonly decks: DeckCount
  readonly dealerHitsSoft17: boolean
  readonly doubleAfterSplit: boolean
  readonly surrenderAllowed: boolean
  readonly penetration: number
  readonly dealSpeed: DealSpeed
}

export interface Session {
  readonly id: string
  readonly startedAt: string
  readonly endedAt?: string
  readonly mode: TrainingMode
  readonly ruleConfig: RuleConfig
  runningCount: number
  decksRemainingEstimate: number
  handNumber: number
  phase: SessionPhase
}

export interface CountCheck {
  readonly sessionId: string
  readonly handNumber: number
  readonly promptType?: PromptType
  readonly expectedCount: number
  readonly enteredCount: number
  readonly expectedAction?: PlayerAction
  readonly enteredAction?: PlayerAction
  readonly responseMs: number
  readonly isCorrect: boolean
  readonly delta: number
  readonly createdAt: string
}

export interface SessionSummary {
  readonly sessionId: string
  readonly handsPlayed: number
  readonly promptAccuracy: number
  readonly avgResponseMs: number
  readonly longestCorrectStreak: number
  readonly totalPrompts: number
  readonly correctPrompts: number
}

export interface ActiveHandState {
  readonly playerHands: Hand[]
  readonly dealerHand: DealerHand
  readonly activeHandIndex: number
  readonly handNumber: number
}

export const DEFAULT_RULES: RuleConfig = {
  decks: 6,
  dealerHitsSoft17: true,
  doubleAfterSplit: true,
  surrenderAllowed: false,
  penetration: 0.75,
  dealSpeed: 'normal',
}
