/**
 * Issue #78 — components/ui/chart.tsx (the Recharts wrapper used by the
 * analytics chart pipeline) had no tested behavior at production data
 * volumes. Recharts itself is mocked out where these components would
 * otherwise depend on real SVG measurement (jsdom doesn't lay out SVG), but
 * ChartTooltipContent, ChartLegendContent, and ChartStyle/ChartContainer's
 * own per-item work (payload iteration, config-driven <style> generation)
 * is exercised directly with thousands of entries — the same shape of work
 * Recharts would hand these components for a large, un-downsampled series.
 */
import { render } from '@testing-library/react'
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

function buildLargeConfig(n: number): ChartConfig {
  const config: ChartConfig = {}
  for (let i = 0; i < n; i++) {
    config[`series_${i}`] = { label: `Series ${i}`, color: `#${(i % 999).toString(16).padStart(3, '0')}` }
  }
  return config
}

function buildLargeTooltipPayload(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    dataKey: `series_${i}`,
    name: `series_${i}`,
    value: i,
    color: '#059669',
    payload: { label: `Point ${i}` },
  }))
}

describe('chart.tsx at production data volumes (Issue #78)', () => {
  it('ChartContainer + ChartStyle render a config with thousands of series without throwing', () => {
    const config = buildLargeConfig(3000)

    const start = Date.now()
    const { container } = render(
      <ChartContainer id="large-series-chart" config={config}>
        <div />
      </ChartContainer>,
    )
    const elapsedMs = Date.now() - start

    const styleTag = container.querySelector('style')
    expect(styleTag).not.toBeNull()
    expect(styleTag!.innerHTML).toContain('--color-series_0:')
    expect(styleTag!.innerHTML).toContain('--color-series_2999:')
    // Generous budget — this is about catching an accidental O(n^2) string
    // build, not asserting a tight perf number that'll flake on slow CI.
    expect(elapsedMs).toBeLessThan(2000)
  })

  it('ChartTooltipContent renders a tooltip payload with thousands of entries without throwing', () => {
    const config = buildLargeConfig(2000)
    const payload = buildLargeTooltipPayload(2000)

    const start = Date.now()
    const { container } = render(
      <ChartContainer id="large-tooltip-chart" config={config}>
        <div>
          {/* ChartTooltipContent normally renders inside Recharts' Tooltip;
             rendered directly here to exercise its own payload-iteration
             work at scale, independent of Recharts' internals. */}
          <ChartTooltipContent active payload={payload as any} />
        </div>
      </ChartContainer>,
    )
    const elapsedMs = Date.now() - start

    expect(container.textContent).toContain('Series 0')
    expect(container.textContent).toContain('Series 1999')
    expect(elapsedMs).toBeLessThan(3000)
  })

  it('ChartLegendContent renders a legend with thousands of entries without throwing', () => {
    const config = buildLargeConfig(2000)
    const payload = Array.from({ length: 2000 }, (_, i) => ({
      value: `series_${i}`,
      dataKey: `series_${i}`,
      color: '#059669',
    }))

    const start = Date.now()
    render(
      <ChartContainer id="large-legend-chart" config={config}>
        <div>
          <ChartLegendContent payload={payload as any} />
        </div>
      </ChartContainer>,
    )
    const elapsedMs = Date.now() - start

    expect(elapsedMs).toBeLessThan(3000)
  })
})
