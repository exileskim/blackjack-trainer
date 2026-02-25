export interface PromptScheduler {
  onHandResolved(): boolean
  onPromptSubmitted(): void
  getHandsSincePrompt(): number
  getNextThreshold(): number
  reset(): void
}

export function createPromptScheduler(
  rng: () => number = Math.random,
): PromptScheduler {
  let handsSincePrompt = 0
  let nextThreshold = pickThreshold(rng)

  function pickThreshold(r: () => number): 4 | 5 {
    return r() < 0.5 ? 4 : 5
  }

  return {
    /**
     * Call after each resolved hand.
     * Returns true if a count prompt should be shown.
     */
    onHandResolved(): boolean {
      handsSincePrompt++
      return handsSincePrompt >= nextThreshold
    },

    /**
     * Call after the user submits their count answer.
     * Resets counter and re-rolls the next threshold.
     */
    onPromptSubmitted(): void {
      handsSincePrompt = 0
      nextThreshold = pickThreshold(rng)
    },

    getHandsSincePrompt(): number {
      return handsSincePrompt
    },

    getNextThreshold(): number {
      return nextThreshold
    },

    reset(): void {
      handsSincePrompt = 0
      nextThreshold = pickThreshold(rng)
    },
  }
}
