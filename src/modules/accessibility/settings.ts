export type TextScale = 'normal' | 'large' | 'xLarge'

export interface AccessibilitySettings {
  highContrast: boolean
  textScale: TextScale
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  textScale: 'normal',
}

const TEXT_SCALE_MULTIPLIER: Record<TextScale, number> = {
  normal: 1,
  large: 1.125,
  xLarge: 1.25,
}

export function normalizeAccessibilitySettings(
  value: Partial<AccessibilitySettings> | null | undefined,
): AccessibilitySettings {
  if (!value) return { ...DEFAULT_ACCESSIBILITY_SETTINGS }
  return {
    highContrast: Boolean(value.highContrast),
    textScale:
      value.textScale === 'large' || value.textScale === 'xLarge'
        ? value.textScale
        : 'normal',
  }
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.toggle('high-contrast', settings.highContrast)
  root.style.setProperty(
    '--app-text-scale',
    TEXT_SCALE_MULTIPLIER[settings.textScale].toString(),
  )
}
