import { BJA_H17_2019_SOURCE } from '@/modules/strategy/sources/bjaH17_2019.ts'

export const INSURANCE_SOURCE = BJA_H17_2019_SOURCE.metadata
export const INSURANCE_RULE = BJA_H17_2019_SOURCE.insurance

export function shouldTakeInsurance(trueCount: number): boolean {
  if (INSURANCE_RULE.comparison === 'gte') {
    return trueCount >= INSURANCE_RULE.tcThreshold
  }
  return trueCount <= INSURANCE_RULE.tcThreshold
}

