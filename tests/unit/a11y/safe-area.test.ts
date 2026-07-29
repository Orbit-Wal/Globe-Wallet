import {
  safeAreaInset,
  getSafeAreaInsetValues,
  safeAreaPadding,
  SAFE_AREA_BOTTOM_NAV_PB,
  SAFE_AREA_MAIN_PB,
  SAFE_AREA_STATUS_BAR_PT,
} from '../../../lib/a11y/safe-area'
import type { SafeAreaSide } from '../../../lib/a11y/safe-area'

describe('safeAreaInset', () => {
  const sides: SafeAreaSide[] = ['top', 'bottom', 'left', 'right']

  it.each(sides)('returns correct env() expression for %s side', (side) => {
    const result = safeAreaInset(side)
    expect(result).toBe(`env(safe-area-inset-${side}, 0px)`)
  })

  it('uses the provided fallback', () => {
    expect(safeAreaInset('bottom', '16px')).toBe('env(safe-area-inset-bottom, 16px)')
  })

  it('defaults fallback to 0px', () => {
    expect(safeAreaInset('top')).toContain('0px')
  })
})

describe('getSafeAreaInsetValues', () => {
  it('returns an object with all four sides', () => {
    const insets = getSafeAreaInsetValues()
    expect(insets).toHaveProperty('top')
    expect(insets).toHaveProperty('bottom')
    expect(insets).toHaveProperty('left')
    expect(insets).toHaveProperty('right')
  })

  it('each value is a CSS env() string', () => {
    const insets = getSafeAreaInsetValues()
    Object.values(insets).forEach((value) => {
      expect(value).toMatch(/^env\(safe-area-inset-/)
    })
  })
})

describe('safeAreaPadding', () => {
  it('returns a 4-part padding shorthand string', () => {
    const result = safeAreaPadding()
    const parts = result.split(/ (?=calc\()/)
    expect(parts).toHaveLength(4)
  })

  it('each part is a calc() wrapping an env()', () => {
    const result = safeAreaPadding('8px')
    const parts = result.split(/ (?=calc\()/)
    expect(parts).toHaveLength(4)
    parts.forEach((part) => {
      expect(part).toMatch(/^calc\(/)
      expect(part).toContain('env(safe-area-inset-')
    })
  })

  it('incorporates the extra spacing argument', () => {
    const result = safeAreaPadding('1rem')
    expect(result).toContain('1rem')
  })
})

describe('exported constants', () => {
  it('SAFE_AREA_BOTTOM_NAV_PB is a calc() expression', () => {
    expect(SAFE_AREA_BOTTOM_NAV_PB).toMatch(/^calc\(/)
    expect(SAFE_AREA_BOTTOM_NAV_PB).toContain('safe-area-inset-bottom')
  })

  it('SAFE_AREA_MAIN_PB uses 6rem as base', () => {
    expect(SAFE_AREA_MAIN_PB).toContain('6rem')
  })

  it('SAFE_AREA_STATUS_BAR_PT is an env() expression for top', () => {
    expect(SAFE_AREA_STATUS_BAR_PT).toContain('safe-area-inset-top')
  })
})
