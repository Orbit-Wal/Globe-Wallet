/**
 * Issue #81: ChartStyle renders a <style> block via dangerouslySetInnerHTML,
 * interpolating the chart `id` and each config entry's key/color. Every
 * current call site passes compile-time-constant config, but the prop types
 * don't enforce that — this proves a maliciously-shaped id/color/key is
 * neutralized rather than reaching the rendered HTML verbatim.
 */
import { render } from '@testing-library/react'
import { ChartContainer, ChartStyle, type ChartConfig } from '@/components/ui/chart'

describe('ChartStyle injection hardening (Issue #81)', () => {
  it('strips unsafe characters from a maliciously-shaped id', () => {
    const maliciousId = 'x"}</style><script>alert(1)</script>'
    const config: ChartConfig = { xlm: { label: 'XLM', color: '#059669' } }

    const { container } = render(<ChartStyle id={maliciousId} config={config} />)
    const styleTag = container.querySelector('style')
    expect(styleTag).not.toBeNull()

    const html = styleTag!.innerHTML
    expect(html).not.toContain('</style><script>')
    expect(html).not.toContain('<script>')
    // The safe remainder of the id (alphanumerics) should still appear,
    // proving this is sanitization, not just refusing to render.
    expect(html).toContain('[data-chart=xstylescriptalert1script]')
  })

  it('drops a config entry whose color value contains breakout characters', () => {
    const config: ChartConfig = {
      safe: { label: 'Safe', color: '#059669' },
      malicious: { label: 'Malicious', color: 'red; } </style><script>alert(1)</script>' },
    }

    const { container } = render(<ChartStyle id="chart-test" config={config} />)
    const html = container.querySelector('style')!.innerHTML

    expect(html).toContain('--color-safe: #059669;')
    expect(html).not.toContain('--color-malicious')
    expect(html).not.toContain('<script>')
  })

  it('drops a config entry whose object key contains unsafe characters', () => {
    const config = {
      'a}</style><script>alert(1)</script>': { label: 'Bad key', color: '#059669' },
      good: { label: 'Good', color: '#111827' },
    } as unknown as ChartConfig

    const { container } = render(<ChartStyle id="chart-test" config={config} />)
    const html = container.querySelector('style')!.innerHTML

    expect(html).not.toContain('<script>')
    expect(html).toContain('--color-good: #111827;')
  })

  it('still renders legitimate hsl(var(--x)) theme colors unchanged', () => {
    const config: ChartConfig = {
      volume: { label: 'Volume', color: 'hsl(var(--primary))' },
    }

    const { container } = render(<ChartStyle id="chart-test" config={config} />)
    const html = container.querySelector('style')!.innerHTML
    expect(html).toContain('--color-volume: hsl(var(--primary));')
  })

  it('ChartContainer sanitizes a caller-supplied id before it reaches data-chart / the style block', () => {
    const config: ChartConfig = { xlm: { label: 'XLM', color: '#059669' } }
    const { container } = render(
      <ChartContainer id={'evil"><script>alert(1)</script>'} config={config}>
        <div />
      </ChartContainer>,
    )

    const chartDiv = container.querySelector('[data-slot="chart"]')!
    const dataChart = chartDiv.getAttribute('data-chart')!
    expect(dataChart).not.toMatch(/[<>"]/)

    const html = container.querySelector('style')!.innerHTML
    expect(html).not.toContain('<script>')
  })
})
