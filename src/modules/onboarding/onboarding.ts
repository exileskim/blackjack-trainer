import { loadSessionHistory } from '@/modules/persistence/repository.ts'

export type OnboardingStep = 'deckCountdown' | 'countingDrill' | 'trueCount' | 'playAndCount'

export interface OnboardingProgress {
  completedSteps: OnboardingStep[]
  currentStep: OnboardingStep
  isComplete: boolean
}

const STORAGE_KEY = 'bjt_onboarding'

const STEP_ORDER: OnboardingStep[] = [
  'deckCountdown',
  'countingDrill',
  'trueCount',
  'playAndCount',
]

export const STEP_META: Record<
  OnboardingStep,
  { label: string; description: string; order: number }
> = {
  deckCountdown: {
    label: 'Card Values',
    description: 'Learn Hi-Lo card values by counting through a full deck',
    order: 1,
  },
  countingDrill: {
    label: 'Running Count',
    description: 'Practice keeping the running count as cards are dealt',
    order: 2,
  },
  trueCount: {
    label: 'True Count',
    description: 'Convert running count to true count with deck estimation',
    order: 3,
  },
  playAndCount: {
    label: 'Full Simulation',
    description: 'Play hands and maintain the count in real time',
    order: 4,
  },
}

function loadCompletedSteps(): OnboardingStep[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OnboardingStep[]
    return parsed.filter((s) => STEP_ORDER.includes(s))
  } catch {
    return []
  }
}

function saveCompletedSteps(steps: OnboardingStep[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(steps))
  } catch {
    // Fail silently
  }
}

export function getOnboardingProgress(): OnboardingProgress {
  const completedSteps = loadCompletedSteps()
  const nextStep = STEP_ORDER.find((s) => !completedSteps.includes(s))
  return {
    completedSteps,
    currentStep: nextStep ?? 'playAndCount',
    isComplete: completedSteps.length >= STEP_ORDER.length,
  }
}

export function completeOnboardingStep(step: OnboardingStep): OnboardingProgress {
  const completed = loadCompletedSteps()
  if (!completed.includes(step)) {
    completed.push(step)
    saveCompletedSteps(completed)
  }
  return getOnboardingProgress()
}

export function resetOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** Returns true if user is new (no sessions and no onboarding steps completed) */
export function isNewUser(): boolean {
  const progress = getOnboardingProgress()
  const history = loadSessionHistory()
  return progress.completedSteps.length === 0 && history.length === 0
}
