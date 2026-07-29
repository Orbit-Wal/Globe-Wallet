/**
 * Dependency vulnerability gate for npm audit JSON reports.
 *
 * Evaluates audit findings against a severity threshold and an explicit
 * allowlist of accepted exceptions. Pure logic — no I/O — so unit tests can
 * exercise every branch without invoking npm.
 */

import { satisfies } from 'semver'

export const SEVERITY_RANK = Object.freeze({
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
})

export const DEFAULT_THRESHOLD = 'moderate'

/**
 * @param {string | undefined} severity
 * @returns {number}
 */
export function severityRank(severity) {
  if (!severity || !(severity in SEVERITY_RANK)) {
    return -1
  }
  return SEVERITY_RANK[/** @type {keyof typeof SEVERITY_RANK} */ (severity)]
}

/**
 * @param {string} threshold
 * @returns {asserts threshold is keyof typeof SEVERITY_RANK}
 */
export function assertValidThreshold(threshold) {
  if (!(threshold in SEVERITY_RANK)) {
    throw new Error(
      `Invalid audit severity threshold "${threshold}". Expected one of: ${Object.keys(SEVERITY_RANK).join(', ')}`,
    )
  }
}

/**
 * @param {string | undefined} version
 * @param {string | undefined} range
 * @returns {boolean} true when the installed version is affected (fail-closed if unknown)
 */
export function isVersionAffected(version, range) {
  if (!range) {
    return true
  }
  if (!version) {
    return true
  }
  try {
    return satisfies(version, range, { includePrerelease: true })
  } catch {
    return true
  }
}

/**
 * Extract advisory objects from an npm audit v2 vulnerability entry.
 * Each `via` item may be an advisory object or a transitive package name string.
 *
 * @param {{ name?: string, severity?: string, via?: unknown[] }} vulnerability
 * @param {string | undefined} installedVersion
 * @returns {Array<{ id: string, package: string, severity: string, title: string, url: string, range?: string }>}
 */
export function extractAdvisories(vulnerability, installedVersion) {
  const packageName = vulnerability.name ?? 'unknown'
  const fallbackSeverity = vulnerability.severity ?? 'info'
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : []

  /** @type {Array<{ id: string, package: string, severity: string, title: string, url: string, range?: string }>} */
  const advisories = []
  let sawAdvisoryObject = false

  for (const item of via) {
    if (!item || typeof item !== 'object') {
      continue
    }
    sawAdvisoryObject = true
    const advisory = /** @type {Record<string, unknown>} */ (item)
    const range = typeof advisory.range === 'string' ? advisory.range : undefined
    if (!isVersionAffected(installedVersion, range)) {
      continue
    }

    const url = typeof advisory.url === 'string' ? advisory.url : ''
    const ghsaMatch = url.match(/GHSA-[\w-]+/i)
    const sourceId =
      typeof advisory.source === 'number' || typeof advisory.source === 'string'
        ? String(advisory.source)
        : ''
    const id = ghsaMatch ? ghsaMatch[0].toUpperCase() : sourceId
    if (!id) {
      continue
    }
    advisories.push({
      id,
      package:
        typeof advisory.name === 'string'
          ? advisory.name
          : typeof advisory.dependency === 'string'
            ? advisory.dependency
            : packageName,
      severity: typeof advisory.severity === 'string' ? advisory.severity : fallbackSeverity,
      title: typeof advisory.title === 'string' ? advisory.title : 'Untitled advisory',
      url,
      range,
    })
  }

  // Only synthesize a package-level finding when npm provided no advisory objects.
  // If advisory objects existed but were all outside the installed version range,
  // the installed release is patched — do not re-block via npm's aggregate range.
  if (advisories.length === 0 && vulnerability.severity && !sawAdvisoryObject) {
    const packageRange =
      typeof /** @type {any} */ (vulnerability).range === 'string'
        ? /** @type {any} */ (vulnerability).range
        : undefined
    if (isVersionAffected(installedVersion, packageRange)) {
      advisories.push({
        id: `package:${packageName}`,
        package: packageName,
        severity: vulnerability.severity,
        title: `Vulnerable package ${packageName}`,
        url: '',
        range: packageRange,
      })
    }
  }

  return advisories
}

/**
 * @param {unknown} auditReport
 * @param {Record<string, string>} [installedVersions]
 * @returns {Array<{ id: string, package: string, severity: string, title: string, url: string, range?: string }>}
 */
export function collectAdvisories(auditReport, installedVersions = {}) {
  if (!auditReport || typeof auditReport !== 'object') {
    return []
  }
  const vulnerabilities = /** @type {Record<string, unknown>} */ (auditReport).vulnerabilities
  if (!vulnerabilities || typeof vulnerabilities !== 'object') {
    return []
  }

  /** @type {Array<{ id: string, package: string, severity: string, title: string, url: string, range?: string }>} */
  const all = []
  const seen = new Set()

  for (const entry of Object.values(vulnerabilities)) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const vuln = /** @type {{ name?: string }} */ (entry)
    const installedVersion = vuln.name ? installedVersions[vuln.name] : undefined
    for (const advisory of extractAdvisories(/** @type {any} */ (entry), installedVersion)) {
      const key = `${advisory.id}|${advisory.package}|${advisory.severity}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      all.push(advisory)
    }
  }

  return all
}

/**
 * @param {{ id?: string, package?: string, reason?: string, expires?: string }} exception
 * @param {{ id: string, package: string }} advisory
 * @param {Date} [now]
 * @returns {boolean}
 */
export function exceptionMatches(exception, advisory, now = new Date()) {
  if (!exception || typeof exception !== 'object') {
    return false
  }

  const idOk = exception.id
    ? exception.id.toUpperCase() === advisory.id.toUpperCase()
    : false
  const packageOk = exception.package ? exception.package === advisory.package : false

  // Require at least one matcher (advisory id and/or package name).
  if (!idOk && !packageOk) {
    return false
  }
  // If both are present, both must match.
  if (exception.id && exception.package && !(idOk && packageOk)) {
    return false
  }

  if (exception.expires) {
    const expiresAt = Date.parse(exception.expires)
    if (Number.isNaN(expiresAt)) {
      throw new Error(
        `Allowlist exception for ${exception.id ?? exception.package} has invalid expires value "${exception.expires}" (use YYYY-MM-DD)`,
      )
    }
    if (now.getTime() > expiresAt) {
      return false
    }
  }
  if (!exception.reason || !String(exception.reason).trim()) {
    throw new Error(
      `Allowlist exception for ${exception.id ?? exception.package} is missing a non-empty "reason" documenting accepted risk`,
    )
  }
  return true
}

/**
 * @param {object} options
 * @param {unknown} options.auditReport
 * @param {{ threshold?: string, exceptions?: Array<{ id?: string, package?: string, reason?: string, expires?: string }> }} [options.allowlist]
 * @param {Record<string, string>} [options.installedVersions]
 * @param {Date} [options.now]
 * @returns {{
 *   threshold: string,
 *   blocking: Array<{ id: string, package: string, severity: string, title: string, url: string }>,
 *   allowed: Array<{ id: string, package: string, severity: string, title: string, url: string, reason: string }>,
 *   belowThreshold: Array<{ id: string, package: string, severity: string, title: string, url: string }>,
 *   ok: boolean,
 * }}
 */
export function evaluateAuditGate({
  auditReport,
  allowlist = {},
  installedVersions = {},
  now = new Date(),
}) {
  const threshold = allowlist.threshold ?? DEFAULT_THRESHOLD
  assertValidThreshold(threshold)
  const thresholdRank = severityRank(threshold)
  const exceptions = Array.isArray(allowlist.exceptions) ? allowlist.exceptions : []

  const blocking = []
  const allowed = []
  const belowThreshold = []

  for (const advisory of collectAdvisories(auditReport, installedVersions)) {
    if (severityRank(advisory.severity) < thresholdRank) {
      belowThreshold.push(advisory)
      continue
    }

    const match = exceptions.find((exception) => exceptionMatches(exception, advisory, now))
    if (match) {
      allowed.push({ ...advisory, reason: String(match.reason) })
      continue
    }

    blocking.push(advisory)
  }

  return {
    threshold,
    blocking,
    allowed,
    belowThreshold,
    ok: blocking.length === 0,
  }
}

/**
 * @param {ReturnType<typeof evaluateAuditGate>} result
 * @returns {string}
 */
export function formatGateResult(result) {
  const lines = [
    `npm audit gate (threshold: ${result.threshold}+)`,
    `  blocking: ${result.blocking.length}`,
    `  allowlisted: ${result.allowed.length}`,
    `  below threshold: ${result.belowThreshold.length}`,
  ]

  if (result.allowed.length) {
    lines.push('Allowlisted findings:')
    for (const item of result.allowed) {
      lines.push(`  - ${item.id} (${item.package}, ${item.severity}): ${item.reason}`)
    }
  }

  if (result.blocking.length) {
    lines.push('Blocking findings:')
    for (const item of result.blocking) {
      const link = item.url ? ` — ${item.url}` : ''
      lines.push(`  - ${item.id} (${item.package}, ${item.severity}): ${item.title}${link}`)
    }
  }

  return lines.join('\n')
}
