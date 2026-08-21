'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/utils'

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: '', dark: '.dark' } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

/*
 * Issue #81: ChartStyle below renders a <style> block via
 * dangerouslySetInnerHTML, interpolating `id` and each config entry's
 * `color`/`theme` values (and its object key) directly into a raw CSS/HTML
 * string.
 *
 * Data-flow trace of every value that reaches that string, as of this fix:
 *   - `THEMES` keys/values: module-level constant ({ light: '', dark:
 *     '.dark' }), never externally influenced.
 *   - `id`: a prop on ChartContainer (React.ComponentProps<'div'>). Every
 *     current call site (components/dashboard/project-analytics-chart.tsx,
 *     components/analytics/analytics-charts.tsx) omits it, so it falls back
 *     to React.useId() (React-internal, colon-stripped). But the prop type
 *     places no constraint on it — a future caller passing an id built from
 *     any external string (an asset code, a URL param, ...) would inject
 *     directly into `[data-chart=${id}]` inside the <style> content, with a
 *     value like `x}</style><script>...` breaking out of both the selector
 *     and the tag. This was the actual live gap: not hypothetical once
 *     someone wires a dynamic id in, and nothing enforced it stayed safe.
 *   - config object keys and `color`/`theme[...]` values: every current
 *     ChartConfig passed to ChartContainer is a module-level `const
 *     chartConfig: ChartConfig = {...}` literal (see the two call sites
 *     above) — not derived from transaction/analytics data. Same risk
 *     shape as `id` though: the type permits any string, so any future
 *     config assembled from asset codes/labels would inject unsanitized
 *     CSS text.
 *
 * Fix: sanitize the id (chart selector must be a safe token) and validate
 * every config key/color against strict allowlists before they reach the
 * template string, so the *type* of value that can reach
 * dangerouslySetInnerHTML is constrained regardless of where a future
 * caller sources it from — rather than only being safe today because every
 * current caller happens to pass constants.
 *
 * The <style dangerouslySetInnerHTML> pattern itself is kept rather than
 * replaced with the `style` prop: this needs per-theme selector scoping
 * (`.dark [data-chart=id] { ... }`), which an inline `style` attribute on a
 * single element cannot express — there's no element to attach a `.dark`
 * conditional inline style to. A React `style` prop can only set properties
 * on the element itself, not conditionally on an ancestor class.
 */
const SAFE_CHART_ID = /^[A-Za-z0-9_-]+$/
const SAFE_CONFIG_KEY = /^[A-Za-z0-9_-]+$/
// Accepts hex colors, rgb()/rgba()/hsl()/hsla()/oklch()/oklab() functional
// notation (including nested var(--x) references, e.g. "hsl(var(--primary))"
// — real values used by this repo's chart configs), CSS custom-property
// references (var(--x)), and bare CSS color keywords/idents (e.g.
// "currentColor", "red", "transparent"). The functional-notation branch
// allowlists the function name but blocklists selector/tag-breakout
// characters (;{}<>`'") inside the parens rather than trying to enumerate
// every legal inner character, since CSS functions can nest arbitrarily
// (hsl(var(--x)), color-mix(...), etc) and an exact grammar isn't worth
// reimplementing here — the blocklist is what actually matters for safety.
const SAFE_CSS_COLOR_VALUE =
  /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|var)\([^;{}<>\\`'"]*\)|[A-Za-z][A-Za-z-]*)$/

function sanitizeChartId(id: string): string {
  return SAFE_CHART_ID.test(id) ? id : id.replace(/[^A-Za-z0-9_-]/g, '')
}

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children']
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${sanitizeChartId(id || uniqueId.replace(/:/g, ''))}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  // ChartStyle is exported standalone (not just used via ChartContainer,
  // which already sanitizes its id), so re-apply the same sanitizer here
  // rather than trusting the caller.
  const safeId = sanitizeChartId(id)

  const colorConfig = Object.entries(config).filter(
    ([key, config]) => (config.theme || config.color) && SAFE_CONFIG_KEY.test(key),
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${safeId}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    if (!color || !SAFE_CSS_COLOR_VALUE.test(color)) return null
    return `  --color-${key}: ${color};`
  })
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<'div'> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: 'line' | 'dot' | 'dashed'
    nameKey?: string
    labelKey?: string
  }) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey || item?.dataKey || item?.name || 'value'}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === 'string'
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn('font-medium', labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      )
    }

    if (!value) {
      return null
    }

    return <div className={cn('font-medium', labelClassName)}>{value}</div>
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== 'dot'

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || 'value'}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)
          const indicatorColor = color || item.payload.fill || item.color

          return (
            <div
              key={item.dataKey}
              className={cn(
                '[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5',
                indicator === 'dot' && 'items-center',
              )}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
                          {
                            'h-2.5 w-2.5': indicator === 'dot',
                            'w-1': indicator === 'line',
                            'w-0 border-[1.5px] border-dashed bg-transparent':
                              indicator === 'dashed',
                            'my-0.5': nestLabel && indicator === 'dashed',
                          },
                        )}
                        style={
                          {
                            '--color-bg': indicatorColor,
                            '--color-border': indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      'flex flex-1 justify-between leading-none',
                      nestLabel ? 'items-end' : 'items-center',
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name}
                      </span>
                    </div>
                    {typeof item.value === 'number' && (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {item.value.toLocaleString()}
                      </span>
                    )}
                    {typeof item.value === 'string' && item.value && (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {item.value}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey,
}: React.ComponentProps<'div'> &
  Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
    hideIcon?: boolean
    nameKey?: string
  }) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || 'value'}`
        const itemConfig = getPayloadConfigFromPayload(config, item, key)

        return (
          <div
            key={item.value}
            className="[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            {itemConfig?.label}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Minimal shape that Recharts injects into tooltip/legend payload items.
 * Using a structural interface keeps this independent of recharts internals
 * while giving downstream code full type safety.
 */
interface RechartsPayloadItem {
  dataKey?: string | number
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  fill?: string
  payload?: Record<string, unknown>
  [key: string]: unknown
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: RechartsPayloadItem,
  key: string,
) {
  const payloadPayload =
    payload.payload !== null && typeof payload.payload === 'object'
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (key in payload && typeof payload[key] === 'string') {
    configLabelKey = payload[key] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === 'string'
  ) {
    configLabelKey = payloadPayload[key] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
