import { describe, it, expect } from 'vitest'
import { createPromptScheduler } from './promptScheduler.ts'

describe('promptScheduler', () => {
  it('triggers after 4 hands with rng < 0.5', () => {
    // rng always returns 0.3 -> threshold = 4
    const scheduler = createPromptScheduler(() => 0.3)
    expect(scheduler.getNextThreshold()).toBe(4)

    expect(scheduler.onHandResolved()).toBe(false) // hand 1
    expect(scheduler.onHandResolved()).toBe(false) // hand 2
    expect(scheduler.onHandResolved()).toBe(false) // hand 3
    expect(scheduler.onHandResolved()).toBe(true) // hand 4 -> trigger
  })

  it('triggers after 5 hands with rng >= 0.5', () => {
    // rng always returns 0.7 -> threshold = 5
    const scheduler = createPromptScheduler(() => 0.7)
    expect(scheduler.getNextThreshold()).toBe(5)

    expect(scheduler.onHandResolved()).toBe(false) // 1
    expect(scheduler.onHandResolved()).toBe(false) // 2
    expect(scheduler.onHandResolved()).toBe(false) // 3
    expect(scheduler.onHandResolved()).toBe(false) // 4
    expect(scheduler.onHandResolved()).toBe(true) // 5 -> trigger
  })

  it('resets counter and re-rolls threshold after submit', () => {
    let callCount = 0
    const rng = () => {
      callCount++
      return callCount <= 1 ? 0.3 : 0.7 // first: 4, second: 5
    }
    const scheduler = createPromptScheduler(rng)
    expect(scheduler.getNextThreshold()).toBe(4)

    // Trigger at 4
    for (let i = 0; i < 4; i++) scheduler.onHandResolved()
    expect(scheduler.getHandsSincePrompt()).toBe(4)

    // Submit -> reset
    scheduler.onPromptSubmitted()
    expect(scheduler.getHandsSincePrompt()).toBe(0)
    expect(scheduler.getNextThreshold()).toBe(5)
  })

  it('never triggers before threshold', () => {
    const scheduler = createPromptScheduler(() => 0.3) // threshold 4
    expect(scheduler.onHandResolved()).toBe(false) // 1
    expect(scheduler.onHandResolved()).toBe(false) // 2
    expect(scheduler.onHandResolved()).toBe(false) // 3
    // Not yet 4
  })

  it('distributes near 50/50 over many resets', () => {
    let i = 0
    const values = Array.from({ length: 1000 }, () => Math.random())
    const rng = () => values[i++ % values.length]!

    const scheduler = createPromptScheduler(rng)
    const thresholds: number[] = []

    for (let run = 0; run < 500; run++) {
      thresholds.push(scheduler.getNextThreshold())
      // Advance past threshold
      while (!scheduler.onHandResolved()) {}
      scheduler.onPromptSubmitted()
    }

    const fours = thresholds.filter((t) => t === 4).length
    const fives = thresholds.filter((t) => t === 5).length

    // Allow generous range for randomness
    expect(fours).toBeGreaterThan(150)
    expect(fives).toBeGreaterThan(150)
    expect(fours + fives).toBe(500)

    // All values should be 4 or 5
    for (const t of thresholds) {
      expect([4, 5]).toContain(t)
    }
  })

  it('reset clears state', () => {
    const scheduler = createPromptScheduler(() => 0.3)
    scheduler.onHandResolved()
    scheduler.onHandResolved()
    expect(scheduler.getHandsSincePrompt()).toBe(2)

    scheduler.reset()
    expect(scheduler.getHandsSincePrompt()).toBe(0)
  })
})
