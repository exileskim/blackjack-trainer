import { describe, it, expect } from 'vitest'
import { shouldTakeInsurance, INSURANCE_RULE, INSURANCE_SOURCE } from './insurance.ts'

describe('insurance strategy', () => {
  it('is sourced from the BJA H17 chart metadata', () => {
    expect(INSURANCE_SOURCE.id).toBe('bja-h17-2019')
    expect(INSURANCE_SOURCE.sourceUrl).toContain('blackjackapprenticeship.com')
  })

  it('uses the chart threshold of TC >= 3', () => {
    expect(INSURANCE_RULE.tcThreshold).toBe(3)
    expect(INSURANCE_RULE.comparison).toBe('gte')
    expect(shouldTakeInsurance(2)).toBe(false)
    expect(shouldTakeInsurance(3)).toBe(true)
    expect(shouldTakeInsurance(6)).toBe(true)
  })
})

