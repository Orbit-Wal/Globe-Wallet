/**
 * Dynamic Colors Catalog & Automated Contrast Inspector
 *
 * Centralizes every dynamic or runtime color path in Globe Wallet and provides an
 * automated WCAG 2.2 AA audit scanner for Light and Dark modes.
 */

import { getContrastRatio, COLOR_MAP } from './contrast'

export interface DynamicColorPath {
  id: string
  component: string
  description: string
  light: {
    fg: string
    bg: string
    wcagTarget: number
  }
  dark: {
    fg: string
    bg: string
    wcagTarget: number
  }
}

export interface ContrastAuditResult {
  id: string
  component: string
  description: string
  lightMode: {
    fg: string
    bg: string
    ratio: number
    target: number
    passed: boolean
  }
  darkMode: {
    fg: string
    bg: string
    ratio: number
    target: number
    passed: boolean
  }
  passed: boolean
}

/**
 * Complete catalog of dynamic and runtime color tokens across Globe Wallet.
 */
export const DYNAMIC_COLOR_CATALOG: DynamicColorPath[] = [
  {
    id: 'tx-status-completed',
    component: 'TransactionStatusBadge',
    description: 'Completed status badge text vs background',
    light: { fg: 'emerald-800', bg: 'emerald-100', wcagTarget: 4.5 },
    dark: { fg: 'emerald-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'tx-status-pending',
    component: 'TransactionStatusBadge',
    description: 'Pending status badge text vs background',
    light: { fg: 'amber-800', bg: 'amber-100', wcagTarget: 4.5 },
    dark: { fg: 'amber-300', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'tx-status-failed',
    component: 'TransactionStatusBadge',
    description: 'Failed status badge text vs background',
    light: { fg: 'red-700', bg: 'red-100', wcagTarget: 4.5 },
    dark: { fg: 'red-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'addr-lookup-resolved',
    component: 'AddressLookupBadge',
    description: 'Resolved address text chip vs card background',
    light: { fg: 'green-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'green-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'addr-lookup-not-found',
    component: 'AddressLookupBadge',
    description: 'Not-found warning chip vs card background',
    light: { fg: 'amber-800', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'amber-300', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'addr-lookup-error',
    component: 'AddressLookupBadge',
    description: 'Error chip vs card background',
    light: { fg: 'red-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'red-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'badge-destructive',
    component: 'Badge',
    description: 'Destructive badge text vs background',
    light: { fg: 'white', bg: 'red-700', wcagTarget: 4.5 },
    dark: { fg: 'white', bg: 'red-700', wcagTarget: 4.5 },
  },
  {
    id: 'crypto-holdings-incoming',
    component: 'TransactionHistoryView',
    description: 'Incoming transaction text vs card background',
    light: { fg: 'emerald-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'emerald-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'crypto-holdings-outgoing',
    component: 'TransactionHistoryView',
    description: 'Outgoing transaction text vs card background',
    light: { fg: 'red-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'red-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'analytics-trend-up',
    component: 'AnalyticsContent',
    description: 'Upward trend indicator text vs card background',
    light: { fg: 'emerald-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'emerald-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'analytics-trend-down',
    component: 'AnalyticsContent',
    description: 'Downward trend indicator text vs card background',
    light: { fg: 'red-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'red-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'project-analytics-peak',
    component: 'ProjectAnalytics',
    description: 'Peak percentage summary text vs card background',
    light: { fg: 'emerald-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'emerald-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'project-analytics-chart-bar',
    component: 'ProjectAnalyticsChart',
    description: 'Chart bar color vs card background (WCAG 2.2 SC 1.4.11 UI Components)',
    light: { fg: 'emerald-700', bg: 'light-card', wcagTarget: 3.0 },
    dark: { fg: 'emerald-400', bg: 'dark-card', wcagTarget: 3.0 },
  },
  {
    id: 'test-coverage-pass',
    component: 'TestCoverageCard',
    description: 'Passing test coverage badge text vs background',
    light: { fg: 'emerald-800', bg: 'emerald-100', wcagTarget: 4.5 },
    dark: { fg: 'emerald-300', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'test-coverage-fail',
    component: 'TestCoverageCard',
    description: 'Failing test coverage badge text vs background',
    light: { fg: 'red-700', bg: 'red-100', wcagTarget: 4.5 },
    dark: { fg: 'red-300', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'team-status-completed',
    component: 'TeamCollaboration',
    description: 'Team member completed status text vs background',
    light: { fg: 'emerald-800', bg: 'emerald-100', wcagTarget: 4.5 },
    dark: { fg: 'emerald-300', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'team-status-in-progress',
    component: 'TeamCollaboration',
    description: 'Team member in-progress status text vs background',
    light: { fg: 'amber-800', bg: 'amber-100', wcagTarget: 4.5 },
    dark: { fg: 'amber-300', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'team-status-pending',
    component: 'TeamCollaboration',
    description: 'Team member pending status text vs background',
    light: { fg: 'rose-800', bg: 'rose-100', wcagTarget: 4.5 },
    dark: { fg: 'rose-300', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'convert-rate-badge',
    component: 'ConvertPage',
    description: 'Live rate update badge text vs card background',
    light: { fg: 'emerald-700', bg: 'light-card', wcagTarget: 4.5 },
    dark: { fg: 'emerald-400', bg: 'dark-card', wcagTarget: 4.5 },
  },
  {
    id: 'muted-foreground-body',
    component: 'GlobalStyles',
    description: 'Muted body text vs background',
    light: { fg: 'light-muted-foreground', bg: 'light-background', wcagTarget: 4.5 },
    dark: { fg: 'dark-muted-foreground', bg: 'dark-background', wcagTarget: 4.5 },
  },
]

/**
 * Runs an automated WCAG 2.2 AA contrast audit across every dynamic color path.
 */
export function auditDynamicColorContrast(
  catalog: DynamicColorPath[] = DYNAMIC_COLOR_CATALOG,
): ContrastAuditResult[] {
  return catalog.map(item => {
    const lightRatio = getContrastRatio(item.light.fg, item.light.bg)
    const darkRatio = getContrastRatio(item.dark.fg, item.dark.bg)

    const lightPassed = lightRatio >= item.light.wcagTarget
    const darkPassed = darkRatio >= item.dark.wcagTarget

    return {
      id: item.id,
      component: item.component,
      description: item.description,
      lightMode: {
        fg: item.light.fg,
        bg: item.light.bg,
        ratio: lightRatio,
        target: item.light.wcagTarget,
        passed: lightPassed,
      },
      darkMode: {
        fg: item.dark.fg,
        bg: item.dark.bg,
        ratio: darkRatio,
        target: item.dark.wcagTarget,
        passed: darkPassed,
      },
      passed: lightPassed && darkPassed,
    }
  })
}
