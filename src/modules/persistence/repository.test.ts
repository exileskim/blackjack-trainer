import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  saveSessionRecord,
  loadSessionHistory,
  saveSettings,
  loadSettings,
  type SessionSnapshot,
  type SessionRecord,
} from './repository.ts'

beforeEach(() => {
  localStorage.clear()
})

const mockSnapshot: SessionSnapshot = {
  sessionId: 'test-123',
  phase: 'handResolved',
  mode: 'countingDrill',
  ruleConfig: {
    decks: 6,
    dealerHitsSoft17: true,
    doubleAfterSplit: true,
    surrenderAllowed: false,
    penetration: 0.75,
    dealSpeed: 'normal',
  },
  runningCount: 3,
  handNumber: 15,
  handsPlayed: 15,
  pendingPrompt: false,
  promptStartTime: null,
  shoeState: {
    cards: [],
    deckCount: 6,
    penetration: 0.75,
  },
  schedulerState: {
    handsSincePrompt: 1,
    nextThreshold: 4,
  },
  countChecks: [
    {
      sessionId: 'test-123',
      handNumber: 5,
      expectedCount: 2,
      enteredCount: 2,
      responseMs: 1500,
      isCorrect: true,
      delta: 0,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  startedAt: '2024-01-01T00:00:00Z',
  savedAt: '2024-01-01T00:05:00Z',
}

describe('active session persistence', () => {
  it('saves and loads a session snapshot', () => {
    saveActiveSession(mockSnapshot)
    const loaded = loadActiveSession()
    expect(loaded).toEqual(mockSnapshot)
  })

  it('returns null when no session saved', () => {
    expect(loadActiveSession()).toBeNull()
  })

  it('clears active session', () => {
    saveActiveSession(mockSnapshot)
    clearActiveSession()
    expect(loadActiveSession()).toBeNull()
  })
})

describe('session history', () => {
  it('saves and loads session records', () => {
    const record: SessionRecord = {
      sessionId: 'rec-1',
      mode: 'countingDrill',
      ruleConfig: mockSnapshot.ruleConfig,
      startedAt: '2024-01-01T00:00:00Z',
      endedAt: '2024-01-01T00:10:00Z',
      handsPlayed: 30,
      countChecks: [],
      summary: {
        totalPrompts: 6,
        correctPrompts: 4,
        accuracy: 66.67,
        avgResponseMs: 2000,
        longestStreak: 3,
      },
    }

    saveSessionRecord(record)
    const history = loadSessionHistory()
    expect(history).toHaveLength(1)
    expect(history[0]!.sessionId).toBe('rec-1')
  })

  it('accumulates multiple records', () => {
    for (let i = 0; i < 5; i++) {
      saveSessionRecord({
        sessionId: `rec-${i}`,
        mode: 'countingDrill',
        ruleConfig: mockSnapshot.ruleConfig,
        startedAt: '2024-01-01T00:00:00Z',
        endedAt: '2024-01-01T00:10:00Z',
        handsPlayed: 10,
        countChecks: [],
        summary: { totalPrompts: 0, correctPrompts: 0, accuracy: 0, avgResponseMs: 0, longestStreak: 0 },
      })
    }
    expect(loadSessionHistory()).toHaveLength(5)
  })

  it('returns empty array when no history', () => {
    expect(loadSessionHistory()).toEqual([])
  })
})

describe('settings persistence', () => {
  it('saves and loads settings', () => {
    saveSettings({ mode: 'playAndCount', ruleConfig: mockSnapshot.ruleConfig })
    const loaded = loadSettings()
    expect(loaded).toEqual({ mode: 'playAndCount', ruleConfig: mockSnapshot.ruleConfig })
  })

  it('returns null when no settings saved', () => {
    expect(loadSettings()).toBeNull()
  })
})
