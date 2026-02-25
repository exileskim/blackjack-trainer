import type { CountCheck, RuleConfig } from '@/modules/domain/types.ts'
import type { TrainingMode, SessionPhase } from '@/modules/domain/enums.ts'
import type { ShoeState } from '@/modules/blackjack/shoe.ts'
import type { PromptSchedulerState } from '@/modules/prompts/promptScheduler.ts'

const STORAGE_KEYS = {
  activeSession: 'bjt_active_session',
  sessionHistory: 'bjt_session_history',
  settings: 'bjt_settings',
} as const

/** Serializable snapshot of a session for autosave/recovery */
export interface SessionSnapshot {
  sessionId: string
  phase: SessionPhase
  mode: TrainingMode
  ruleConfig: RuleConfig
  runningCount: number
  handNumber: number
  handsPlayed: number
  countChecks: CountCheck[]
  pendingPrompt: boolean
  promptStartTime: number | null
  shoeState: ShoeState
  schedulerState: PromptSchedulerState
  startedAt: string
  savedAt: string
}

/** Completed session record for history */
export interface SessionRecord {
  sessionId: string
  mode: TrainingMode
  ruleConfig: RuleConfig
  startedAt: string
  endedAt: string
  handsPlayed: number
  countChecks: CountCheck[]
  summary: {
    totalPrompts: number
    correctPrompts: number
    accuracy: number
    avgResponseMs: number
    longestStreak: number
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// --- Active session autosave ---

export function saveActiveSession(snapshot: SessionSnapshot): void {
  writeJson(STORAGE_KEYS.activeSession, snapshot)
}

export function loadActiveSession(): SessionSnapshot | null {
  return readJson<SessionSnapshot>(STORAGE_KEYS.activeSession)
}

export function clearActiveSession(): void {
  localStorage.removeItem(STORAGE_KEYS.activeSession)
}

// --- Session history ---

export function saveSessionRecord(record: SessionRecord): void {
  const history = loadSessionHistory()
  history.push(record)
  // Keep last 100 sessions
  if (history.length > 100) history.splice(0, history.length - 100)
  writeJson(STORAGE_KEYS.sessionHistory, history)
}

export function loadSessionHistory(): SessionRecord[] {
  return readJson<SessionRecord[]>(STORAGE_KEYS.sessionHistory) ?? []
}

// --- Settings persistence ---

export interface PersistedSettings {
  mode: TrainingMode
  ruleConfig: RuleConfig
}

export function saveSettings(settings: PersistedSettings): void {
  writeJson(STORAGE_KEYS.settings, settings)
}

export function loadSettings(): PersistedSettings | null {
  return readJson<PersistedSettings>(STORAGE_KEYS.settings)
}
