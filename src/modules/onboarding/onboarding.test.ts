import { beforeEach, describe, it, expect } from 'vitest'
import {
  getOnboardingProgress,
  completeOnboardingStep,
  resetOnboarding,
  isNewUser,
} from './onboarding.ts'

beforeEach(() => {
  localStorage.clear()
})

describe('onboarding progress', () => {
  it('starts with no completed steps', () => {
    const progress = getOnboardingProgress()
    expect(progress.completedSteps).toEqual([])
    expect(progress.currentStep).toBe('deckCountdown')
    expect(progress.isComplete).toBe(false)
  })

  it('advances through steps in order', () => {
    completeOnboardingStep('deckCountdown')
    expect(getOnboardingProgress().currentStep).toBe('countingDrill')

    completeOnboardingStep('countingDrill')
    expect(getOnboardingProgress().currentStep).toBe('trueCount')

    completeOnboardingStep('trueCount')
    expect(getOnboardingProgress().currentStep).toBe('playAndCount')
  })

  it('marks complete after all steps done', () => {
    completeOnboardingStep('deckCountdown')
    completeOnboardingStep('countingDrill')
    completeOnboardingStep('trueCount')
    completeOnboardingStep('playAndCount')

    const progress = getOnboardingProgress()
    expect(progress.isComplete).toBe(true)
    expect(progress.completedSteps).toHaveLength(4)
  })

  it('does not duplicate completed steps', () => {
    completeOnboardingStep('deckCountdown')
    completeOnboardingStep('deckCountdown')
    expect(getOnboardingProgress().completedSteps).toHaveLength(1)
  })

  it('allows completing steps out of order', () => {
    completeOnboardingStep('trueCount')
    const progress = getOnboardingProgress()
    expect(progress.completedSteps).toEqual(['trueCount'])
    // Still recommends the first uncompleted step
    expect(progress.currentStep).toBe('deckCountdown')
  })

  it('resets progress', () => {
    completeOnboardingStep('deckCountdown')
    completeOnboardingStep('countingDrill')
    resetOnboarding()
    expect(getOnboardingProgress().completedSteps).toEqual([])
  })
})

describe('isNewUser', () => {
  it('returns true when no history and no onboarding', () => {
    expect(isNewUser()).toBe(true)
  })

  it('returns false after completing an onboarding step', () => {
    completeOnboardingStep('deckCountdown')
    expect(isNewUser()).toBe(false)
  })

  it('returns false when session history exists', () => {
    localStorage.setItem('bjt_session_history', JSON.stringify([{ sessionId: 'x' }]))
    expect(isNewUser()).toBe(false)
  })
})
