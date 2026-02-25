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
  slow: 2000,
  normal: 1200,
  fast: 600,
  veryFast: 300,
}

export const DECK_COUNTS = [1, 2, 6, 8] as const
export type DeckCount = (typeof DECK_COUNTS)[number]
