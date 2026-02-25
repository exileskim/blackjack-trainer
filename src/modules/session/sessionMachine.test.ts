import { describe, it, expect } from 'vitest'
import { canTransition, assertTransition } from './sessionMachine.ts'

describe('sessionMachine', () => {
  describe('canTransition', () => {
    it('allows idle -> ready', () => {
      expect(canTransition('idle', 'ready')).toBe(true)
    })

    it('allows ready -> dealing', () => {
      expect(canTransition('ready', 'dealing')).toBe(true)
    })

    it('allows dealing -> awaitingPlayerAction', () => {
      expect(canTransition('dealing', 'awaitingPlayerAction')).toBe(true)
    })

    it('allows dealing -> handResolved (counting drill)', () => {
      expect(canTransition('dealing', 'handResolved')).toBe(true)
    })

    it('allows dealerTurn -> handResolved', () => {
      expect(canTransition('dealerTurn', 'handResolved')).toBe(true)
    })

    it('allows handResolved -> dealing (next hand)', () => {
      expect(canTransition('handResolved', 'dealing')).toBe(true)
    })

    it('allows handResolved -> countPromptOpen', () => {
      expect(canTransition('handResolved', 'countPromptOpen')).toBe(true)
    })

    it('allows handResolved -> completed', () => {
      expect(canTransition('handResolved', 'completed')).toBe(true)
    })

    it('allows countPromptOpen -> handResolved', () => {
      expect(canTransition('countPromptOpen', 'handResolved')).toBe(true)
    })

    it('allows paused -> dealing (resume)', () => {
      expect(canTransition('paused', 'dealing')).toBe(true)
    })

    it('allows completed -> idle', () => {
      expect(canTransition('completed', 'idle')).toBe(true)
    })

    // Invalid transitions
    it('rejects idle -> dealing', () => {
      expect(canTransition('idle', 'dealing')).toBe(false)
    })

    it('rejects ready -> completed', () => {
      expect(canTransition('ready', 'completed')).toBe(false)
    })

    it('rejects dealing -> idle', () => {
      expect(canTransition('dealing', 'idle')).toBe(false)
    })
  })

  describe('assertTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() => assertTransition('idle', 'ready')).not.toThrow()
    })

    it('throws for invalid transition', () => {
      expect(() => assertTransition('idle', 'dealing')).toThrow('Invalid session transition')
    })
  })
})
