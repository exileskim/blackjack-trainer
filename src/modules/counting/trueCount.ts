/**
 * Compute true count from running count and estimated decks remaining.
 * Uses standard floor rounding (truncation toward zero).
 */
export function computeTrueCount(runningCount: number, decksRemaining: number): number {
  if (decksRemaining <= 0) return runningCount
  return Math.trunc(runningCount / decksRemaining)
}

/**
 * Estimate decks remaining from cards left in shoe.
 */
export function estimateDecksRemaining(cardsRemaining: number): number {
  return cardsRemaining / 52
}
