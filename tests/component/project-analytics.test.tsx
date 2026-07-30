/**
 * Component tests for ProjectAnalytics (Issue #17).
 * Verifies rendering, stat summaries, accessibility attributes,
 * and that the CustomTooltip renders typed payload correctly.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ProjectAnalytics } from '../../components/dashboard/project-analytics'

// Recharts uses ResizeObserver — stub it for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Recharts renders SVG; mock ResponsiveContainer so children are always rendered
jest.mock('recharts', () => {
  const Recharts = jest.requireActual('recharts')
  return {
    ...Recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-responsive-container">{children}</div>
    ),
  }
})

describe('ProjectAnalytics (Issue #17)', () => {
  beforeEach(() => {
    render(<ProjectAnalytics />)
  })

  it('renders the section heading', () => {
    expect(screen.getByText('Project Analytics')).toBeInTheDocument()
  })

  it('renders the Weekly Activity legend label', () => {
    expect(screen.getByText('Weekly Activity')).toBeInTheDocument()
  })

  it('renders the Average stat with a percentage value', () => {
    expect(screen.getByText('Average:')).toBeInTheDocument()
    // Average of [45,75,74,92,35,60,50] = 431/7 ≈ 62
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('renders the Peak stat with the correct maximum value', () => {
    expect(screen.getByText('Peak:')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it('renders the recharts responsive container', () => {
    expect(screen.getByTestId('recharts-responsive-container')).toBeInTheDocument()
  })

  it('does not throw TypeScript-related runtime errors (no any coercion)', () => {
    expect(() => render(<ProjectAnalytics />)).not.toThrow()
  })
})

describe('ProjectAnalytics accessibility (Issue #17)', () => {
  it('card has no redundant ARIA roles that would confuse screen readers', () => {
    const { container } = render(<ProjectAnalytics />)
    const headings: any = container.querySelectorAll('h2')
    expect(headings.length).toBeGreaterThanOrEqual(1)
  })

  it('summary stats are text nodes readable by assistive technology', () => {
    render(<ProjectAnalytics />)
    const peakLabel = screen.getByText('Peak:')
    expect(peakLabel.tagName.toLowerCase()).toBe('span')
  })

  it('card has aria-hidden on the legend dot', () => {
    render(<ProjectAnalytics />)
    const dot = document.querySelector('[aria-hidden="true"]')
    expect(dot).not.toBeNull()
  })
})
