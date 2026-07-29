/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = resolve(__dirname, '../../..')
const gateModule = pathToFileURL(resolve(root, 'lib/security/npm-audit-gate.mjs')).href

function runGateEval(expression: string, environment: Record<string, string> = {}) {
  const script = `
    import {
      evaluateAuditGate,
      formatGateResult,
      isVersionAffected,
    } from '${gateModule}';
    const sampleAuditReport = ${JSON.stringify(sampleAuditReport())};
    const result = ${expression};
    console.log(JSON.stringify(result));
  `
  return execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...environment },
  }).trim()
}

function sampleAuditReport() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      next: {
        name: 'next',
        severity: 'high',
        range: '9.3.4-canary.0 - 16.3.0-canary.5',
        via: [
          {
            source: 1112646,
            name: 'next',
            dependency: 'next',
            title: 'Next.js HTTP request deserialization DoS',
            url: 'https://github.com/advisories/GHSA-h25m-26qc-wcjf',
            severity: 'high',
            range: '>=16.0.0-beta.0 <16.0.11',
          },
          {
            source: 1112592,
            name: 'next',
            dependency: 'next',
            title: 'Image Optimizer DoS',
            url: 'https://github.com/advisories/GHSA-9g9p-9gw9-jx7f',
            severity: 'moderate',
            range: '>=15.6.0-canary.0 <16.1.5',
          },
          {
            source: 1117930,
            name: 'next',
            dependency: 'next',
            title: 'DoS with Server Components',
            url: 'https://github.com/advisories/GHSA-8h8q-6873-q5fj',
            severity: 'high',
            range: '>=16.0.0 <16.2.5',
          },
          'postcss',
        ],
      },
      postcss: {
        name: 'postcss',
        severity: 'moderate',
        range: '<8.5.10',
        via: [
          {
            source: 1117015,
            name: 'postcss',
            dependency: 'postcss',
            title: 'PostCSS XSS via unescaped style close tag',
            url: 'https://github.com/advisories/GHSA-qx2v-qp2m-jg93',
            severity: 'moderate',
            range: '<8.5.10',
          },
        ],
      },
      'dev-only': {
        name: 'dev-only',
        severity: 'low',
        via: [
          {
            source: 1,
            name: 'dev-only',
            title: 'Low severity sample',
            url: 'https://github.com/advisories/GHSA-low0-0000-0000',
            severity: 'low',
          },
        ],
      },
    },
  }
}

describe('npm audit gate (dependency SCA)', () => {
  it('blocks moderate+ findings that still apply to installed versions', () => {
    const raw = runGateEval(`evaluateAuditGate({
      auditReport: sampleAuditReport,
      allowlist: { threshold: 'moderate', exceptions: [] },
      installedVersions: { next: '16.0.10', postcss: '8.4.31', 'dev-only': '1.0.0' },
    })`)
    const result = JSON.parse(raw)
    expect(result.ok).toBe(false)
    expect(result.blocking.map((item: { id: string }) => item.id).sort()).toEqual([
      'GHSA-8H8Q-6873-Q5FJ',
      'GHSA-9G9P-9GW9-JX7F',
      'GHSA-H25M-26QC-WCJF',
      'GHSA-QX2V-QP2M-JG93',
    ])
    expect(result.belowThreshold.map((item: { id: string }) => item.id)).toEqual([
      'GHSA-LOW0-0000-0000',
    ])
  })

  it('ignores advisories whose range no longer includes the installed version', () => {
    const raw = runGateEval(`evaluateAuditGate({
      auditReport: sampleAuditReport,
      allowlist: { threshold: 'moderate', exceptions: [] },
      installedVersions: { next: '16.2.10', postcss: '8.5.19', 'dev-only': '1.0.0' },
    })`)
    const result = JSON.parse(raw)
    expect(result.ok).toBe(true)
    expect(result.blocking).toEqual([])
  })

  it('honors explicit allowlist exceptions with a documented reason', () => {
    const raw = runGateEval(`evaluateAuditGate({
      auditReport: sampleAuditReport,
      allowlist: {
        threshold: 'high',
        exceptions: [
          {
            id: 'GHSA-H25M-26QC-WCJF',
            package: 'next',
            reason: 'Temporary accepted risk while upgrade is staged; tracked in issue #0.',
            expires: '2099-01-01',
          },
          {
            id: 'GHSA-8H8Q-6873-Q5FJ',
            package: 'next',
            reason: 'Same temporary exception for remaining high advisory.',
            expires: '2099-01-01',
          },
        ],
      },
      installedVersions: { next: '16.0.10', postcss: '8.4.31' },
    })`)
    const result = JSON.parse(raw)
    expect(result.ok).toBe(true)
    expect(result.allowed.length).toBeGreaterThanOrEqual(2)
  })

  it('rejects allowlist entries missing a reason', () => {
    expect(() =>
      runGateEval(`evaluateAuditGate({
        auditReport: sampleAuditReport,
        allowlist: {
          threshold: 'high',
          exceptions: [{ id: 'GHSA-H25M-26QC-WCJF', package: 'next' }],
        },
        installedVersions: { next: '16.0.10' },
      })`),
    ).toThrow(/missing a non-empty "reason"/)
  })

  it('does not apply expired allowlist exceptions', () => {
    const raw = runGateEval(`evaluateAuditGate({
      auditReport: sampleAuditReport,
      allowlist: {
        threshold: 'high',
        exceptions: [
          {
            id: 'GHSA-H25M-26QC-WCJF',
            package: 'next',
            reason: 'Was accepted until patch landed.',
            expires: '2020-01-01',
          },
        ],
      },
      installedVersions: { next: '16.0.10' },
      now: new Date('2026-07-19T00:00:00Z'),
    })`)
    const result = JSON.parse(raw)
    expect(result.ok).toBe(false)
    expect(result.blocking.some((item: { id: string }) => item.id === 'GHSA-H25M-26QC-WCJF')).toBe(
      true,
    )
  })

  it('rejects invalid severity thresholds', () => {
    expect(() =>
      runGateEval(`evaluateAuditGate({
        auditReport: { vulnerabilities: {} },
        allowlist: { threshold: 'urgent' },
      })`),
    ).toThrow(/Invalid audit severity threshold/)
  })

  it('passes on an empty audit report and formats a summary', () => {
    const raw = runGateEval(`(() => {
      const result = evaluateAuditGate({
        auditReport: { vulnerabilities: {} },
        allowlist: { threshold: 'moderate', exceptions: [] },
      });
      return { ok: result.ok, summary: formatGateResult(result) };
    })()`)
    const result = JSON.parse(raw)
    expect(result.ok).toBe(true)
    expect(result.summary).toMatch(/blocking: 0/)
  })

  it('treats unknown versions as affected (fail-closed)', () => {
    const raw = runGateEval(`isVersionAffected(undefined, '<8.5.10')`)
    expect(JSON.parse(raw)).toBe(true)
  })

  it('keeps the committed allowlist schema valid and empty of silent exceptions', () => {
    const allowlist = JSON.parse(
      readFileSync(resolve(root, 'security/npm-audit-allowlist.json'), 'utf8'),
    )
    expect(Array.isArray(allowlist.exceptions)).toBe(true)
  })

  it('passes the live audit:gate CLI against the current dependency tree', () => {
    const output = execFileSync(process.execPath, ['scripts/npm-audit-gate.mjs'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    })
    expect(output).toMatch(/Dependency vulnerability gate passed/)
  })
})
