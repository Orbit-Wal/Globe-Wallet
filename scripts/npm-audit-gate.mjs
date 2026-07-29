#!/usr/bin/env node
/**
 * CI/local dependency vulnerability gate.
 *
 * Runs `npm audit --json`, applies security/npm-audit-allowlist.json, and
 * exits non-zero when any finding at or above the configured threshold is not
 * explicitly allowlisted with a documented reason.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import {
  evaluateAuditGate,
  formatGateResult,
} from '../lib/security/npm-audit-gate.mjs'

const root = process.cwd()
const allowlistPath = resolve(root, 'security/npm-audit-allowlist.json')
const require = createRequire(import.meta.url)

function loadAllowlist() {
  const raw = readFileSync(allowlistPath, 'utf8')
  return JSON.parse(raw)
}

function runNpmAuditJson() {
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  })

  // npm audit exits 1 when vulnerabilities exist; still parse stdout JSON.
  const stdout = result.stdout || ''
  if (!stdout.trim()) {
    const detail = result.stderr || result.error?.message || `exit ${result.status}`
    throw new Error(`npm audit produced no JSON output: ${detail}`)
  }

  try {
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(`Failed to parse npm audit JSON: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * Resolve installed versions for packages named in the audit report so advisory
 * ranges that no longer apply to the installed release are ignored.
 *
 * @param {unknown} auditReport
 * @returns {Record<string, string>}
 */
function resolveInstalledVersions(auditReport) {
  /** @type {Record<string, string>} */
  const versions = {}
  const vulnerabilities =
    auditReport && typeof auditReport === 'object'
      ? /** @type {{ vulnerabilities?: Record<string, { name?: string }> }} */ (auditReport)
          .vulnerabilities
      : undefined

  if (!vulnerabilities) {
    return versions
  }

  for (const entry of Object.values(vulnerabilities)) {
    const name = entry?.name
    if (!name || versions[name]) {
      continue
    }
    const packageJsonPath = resolve(root, 'node_modules', name, 'package.json')
    if (!existsSync(packageJsonPath)) {
      continue
    }
    try {
      const pkg = require(packageJsonPath)
      if (pkg?.version) {
        versions[name] = String(pkg.version)
      }
    } catch {
      // ignore unreadable package manifests
    }
  }

  return versions
}

function main() {
  const allowlist = loadAllowlist()
  const auditReport = runNpmAuditJson()
  const installedVersions = resolveInstalledVersions(auditReport)
  const result = evaluateAuditGate({ auditReport, allowlist, installedVersions })
  const summary = formatGateResult(result)
  console.log(summary)

  if (Object.keys(installedVersions).length) {
    console.log(
      `Installed versions considered: ${Object.entries(installedVersions)
        .map(([name, version]) => `${name}@${version}`)
        .join(', ')}`,
    )
  }

  if (!result.ok) {
    console.error(
      `\nDependency vulnerability gate failed. Patch the packages, or add a time-bounded exception to ${allowlistPath} with a documented reason.`,
    )
    process.exit(1)
  }

  console.log('\nDependency vulnerability gate passed.')
}

main()
