export interface PromptScheduler {
  onHandResolved(): boolean
  onPromptSubmitted(): void
  getHandsSincePrompt(): number
  getNextThreshold(): number
  reset(): void
  serialize(): PromptSchedulerState
}

export interface PromptSchedulerState {
  handsSincePrompt: number
  nextThreshold: 4 | 5
}

export function createPromptScheduler(
  rng: () => number = Math.random,
): PromptScheduler {
  return createPromptSchedulerInternal(rng)
}

export function createPromptSchedulerFromState(
  state: PromptSchedulerState,
  rng: () => number = Math.random,
): PromptScheduler {
  const handsSincePrompt = Math.max(0, Math.trunc(state.handsSincePrompt))
  const nextThreshold: 4 | 5 = state.nextThreshold === 5 ? 5 : 4
  return createPromptSchedulerInternal(rng, handsSincePrompt, nextThreshold)
}

function createPromptSchedulerInternal(
  rng: () => number,
  initialHandsSincePrompt = 0,
  initialThreshold?: 4 | 5,
): PromptScheduler {
  function pickThreshold(r: () => number): 4 | 5 {
    return r() < 0.5 ? 4 : 5
  }

  let handsSincePrompt = initialHandsSincePrompt
  let nextThreshold = initialThreshold ?? pickThreshold(rng)

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

    serialize(): PromptSchedulerState {
      return {
        handsSincePrompt,
        nextThreshold,
      }
    },
  }
}
