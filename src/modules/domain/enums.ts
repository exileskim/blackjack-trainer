export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
export type Rank = (typeof RANKS)[number]

export const SUITS = ['S', 'H', 'D', 'C'] as const
export type Suit = (typeof SUITS)[number]

export type HandOutcome = 'win' | 'loss' | 'push' | 'blackjack' | 'surrender'

export type SessionPhase =
  | 'idle'
  | 'ready'
  | 'dealing'
  | 'awaitingPlayerAction'
  | 'dealerTurn'
  | 'handResolved'
  | 'countPromptOpen'
  | 'paused'
  | 'completed'

export type TrainingMode = 'countingDrill' | 'playAndCount'

export type DealSpeed = 'slow' | 'normal' | 'fast' | 'veryFast'

export type PlayerAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender'

export const DEAL_SPEED_MS: Record<DealSpeed, number> = {
  slow: 5000,
  normal: 2500,
  fast: 1200,
  veryFast: 600,
}

/**
 * Per-phase timing for dealer turn animation.
 * Controls how long each dealer card is visible before the next is drawn.
 */
export const DEALER_CARD_DELAY_MS: Record<DealSpeed, number> = {
  slow: 1500,
  normal: 800,
  fast: 400,
  veryFast: 200,
}

/**
 * Delay before dealer turn begins (showing initial deal before resolution starts).
 * Applies to counting drill where the hand auto-resolves.
 */
export const DEALER_REVEAL_DELAY_MS: Record<DealSpeed, number> = {
  slow: 2000,
  normal: 1000,
  fast: 500,
  veryFast: 250,
}

export const PROMPT_TYPES = ['runningCount', 'trueCount', 'bestAction'] as const
export type PromptType = (typeof PROMPT_TYPES)[number]

export const DEAL_SPEEDS: DealSpeed[] = ['slow', 'normal', 'fast', 'veryFast']

export const DECK_COUNTS = [1, 2, 6, 8] as const
export type DeckCount = (typeof DECK_COUNTS)[number]
