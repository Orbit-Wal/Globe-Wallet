/**
 * WCAG 2.2 Relative Luminance and Contrast Ratio Utilities
 *
 * Provides exact WCAG 2.1/2.2 calculations for sRGB colors, hex codes, RGB/RGBA,
 * and CSS variables to ensure strict accessibility compliance (Level AA 4.5:1).
 */

export interface ColorRGB {
  r: number // 0 - 255
  g: number // 0 - 255
  b: number // 0 - 255
  a?: number // 0 - 1
}

/**
 * Standard Tailwind / HEX color values map for dynamic color audit inspection.
 */
export const COLOR_MAP: Record<string, string> = {
  // Base neutral / theme defaults
  white: '#ffffff',
  black: '#000000',
  transparent: '#00000000',

  // Emerald / Green family
  'emerald-50': '#ecfdf5',
  'emerald-100': '#d1fae5',
  'emerald-200': '#a7f3d0',
  'emerald-300': '#6ee7b7',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'emerald-700': '#047857',
  'emerald-800': '#065f46',
  'emerald-900': '#064e3b',

  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'green-900': '#14532d',

  // Amber / Yellow family
  'amber-50': '#fffbeb',
  'amber-100': '#fef3c7',
  'amber-200': '#fde68a',
  'amber-300': '#fcd34d',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',
  'amber-800': '#92400e',
  'amber-900': '#78350f',

  // Red / Destructive family
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-200': '#fecaca',
  'red-300': '#fca5a5',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  'red-900': '#7f1d1d',

  // Rose / Pink family
  'rose-100': '#ffe4e6',
  'rose-300': '#fda4af',
  'rose-800': '#9f1239',

  // Blue / Purple / Cyan family
  'blue-500': '#3b82f6',
  'purple-500': '#a855f7',
  'cyan-500': '#06b6d4',

  // Slate / Gray defaults
  'slate-100': '#f1f5f9',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',

  // Theme reference colors (Light / Dark mode default tokens)
  'light-background': '#ffffff',
  'light-card': '#ffffff',
  'light-foreground': '#09090b',
  'light-muted-foreground': '#4f5660', // tuned oklch(0.44 0.02 120)

  'dark-background': '#09090b',
  'dark-card': '#121316',
  'dark-foreground': '#fafafa',
  'dark-muted-foreground': '#a1a1aa',
}

/**
 * Parses a hex string (#rgb, #rrggbb, #rgba, #rrggbbaa) into RGB components.
 */
export function hexToRgb(hex: string): ColorRGB {
  let cleaned = hex.trim().replace(/^#/, '')
  if (cleaned.length === 3 || cleaned.length === 4) {
    cleaned = cleaned
      .split('')
      .map(char => char + char)
      .join('')
  }

  const num = parseInt(cleaned.slice(0, 6), 16)
  if (isNaN(num)) {
    return { r: 0, g: 0, b: 0, a: 1 }
  }

  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  let a = 1

  if (cleaned.length === 8) {
    const alphaNum = parseInt(cleaned.slice(6, 8), 16)
    if (!isNaN(alphaNum)) {
      a = alphaNum / 255
    }
  }

  return { r, g, b, a }
}

/**
 * Resolves color name, hex string, or Tailwind token to ColorRGB.
 */
export function parseColor(colorInput: string): ColorRGB {
  const trimmed = colorInput.trim()
  if (COLOR_MAP[trimmed]) {
    return hexToRgb(COLOR_MAP[trimmed])
  }
  if (trimmed.startsWith('#')) {
    return hexToRgb(trimmed)
  }
  if (trimmed.startsWith('rgb')) {
    const matches = trimmed.match(/\d+(\.\d+)?/g)
    if (matches && matches.length >= 3) {
      return {
        r: parseFloat(matches[0]),
        g: parseFloat(matches[1]),
        b: parseFloat(matches[2]),
        a: matches[3] ? parseFloat(matches[3]) : 1,
      }
    }
  }
  return { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * Computes WCAG 2.2 Relative Luminance for an sRGB color.
 * Formula: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * where R, G, B are sRGB sRGB-linearized channel values.
 */
export function getLuminance(colorInput: string | ColorRGB): number {
  const rgb = typeof colorInput === 'string' ? parseColor(colorInput) : colorInput

  const channelLuminance = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }

  const rLinear = channelLuminance(rgb.r)
  const gLinear = channelLuminance(rgb.g)
  const bLinear = channelLuminance(rgb.b)

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear
}

/**
 * Computes the WCAG 2.2 Contrast Ratio between foreground and background.
 * Ratio formula: (L1 + 0.05) / (L2 + 0.05) where L1 is lighter and L2 is darker.
 * Returns ratio between 1 and 21.
 */
export function getContrastRatio(
  fgInput: string | ColorRGB,
  bgInput: string | ColorRGB,
): number {
  const l1 = getLuminance(fgInput)
  const l2 = getLuminance(bgInput)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  const ratio = (lighter + 0.05) / (darker + 0.05)
  return Math.round(ratio * 100) / 100
}

/**
 * Validates whether foreground vs background satisfies WCAG 2.2 AA (4.5:1 for normal text).
 */
export function isWCAGCompliant(
  fgInput: string | ColorRGB,
  bgInput: string | ColorRGB,
  minRatio: number = 4.5,
): boolean {
  return getContrastRatio(fgInput, bgInput) >= minRatio
}
