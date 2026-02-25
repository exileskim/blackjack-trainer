export type CadenceTier = 'tight' | 'normal'

export interface PromptScheduler {
  onHandResolved(): boolean
  onPromptSubmitted(): void
  getHandsSincePrompt(): number
  getNextThreshold(): number
  getCadenceTier(): CadenceTier
  adaptCadence(recentMissRate: number): void
  reset(): void
  serialize(): PromptSchedulerState
}

export interface PromptSchedulerState {
  handsSincePrompt: number
  nextThreshold: number
  cadenceTier: CadenceTier
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
  const cadenceTier: CadenceTier = state.cadenceTier === 'tight' ? 'tight' : 'normal'
  const thresholdRange = cadenceTier === 'tight' ? [2, 3] as const : [4, 5] as const
  const nextThreshold = state.nextThreshold >= thresholdRange[0] && state.nextThreshold <= thresholdRange[1]
    ? state.nextThreshold
    : thresholdRange[0]
  return createPromptSchedulerInternal(rng, handsSincePrompt, nextThreshold, cadenceTier)
}

function createPromptSchedulerInternal(
  rng: () => number,
  initialHandsSincePrompt = 0,
  initialThreshold?: number,
  initialCadenceTier: CadenceTier = 'normal',
): PromptScheduler {
  let cadenceTier = initialCadenceTier

  function thresholdRange(): [number, number] {
    return cadenceTier === 'tight' ? [2, 3] : [4, 5]
  }

  function pickThreshold(r: () => number): number {
    const [lo, hi] = thresholdRange()
    return r() < 0.5 ? lo : hi
  }

  let handsSincePrompt = initialHandsSincePrompt
  let nextThreshold = initialThreshold ?? pickThreshold(rng)

  return {
    onHandResolved(): boolean {
      handsSincePrompt++
      return handsSincePrompt >= nextThreshold
    },

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

    getCadenceTier(): CadenceTier {
      return cadenceTier
    },

    /**
     * Adapt cadence based on recent miss rate.
     * missRate >= 0.5 → tighten to 2-3 hands
     * missRate < 0.5 → restore to 4-5 hands
     */
    adaptCadence(recentMissRate: number): void {
      const newTier: CadenceTier = recentMissRate >= 0.5 ? 'tight' : 'normal'
      if (newTier !== cadenceTier) {
        cadenceTier = newTier
        // Re-roll threshold for new range
        nextThreshold = pickThreshold(rng)
      }
    },

    reset(): void {
      cadenceTier = 'normal'
      handsSincePrompt = 0
      nextThreshold = pickThreshold(rng)
    },

    serialize(): PromptSchedulerState {
      return {
        handsSincePrompt,
        nextThreshold,
        cadenceTier,
      }
    },
  }
}
