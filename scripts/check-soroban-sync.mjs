#!/usr/bin/env node

/**
 * check-soroban-sync.mjs
 *
 * Validates that contracts/soroban-spec.json stays synchronized with the
 * GlobeWallet contract source (globe-wallet/src/lib.rs).
 *
 * Usage:
 *   node scripts/check-soroban-sync.mjs [--contract-repo PATH]
 *
 * If --contract-repo is not provided, the script looks for the contract
 * source at ../contract/relative to the Globe-Wallet root.
 *
 * Exit codes:
 *   0  — spec is in sync (or contract source unavailable, spec-only validation)
 *   1  — drift detected or spec is invalid
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SPEC_PATH = resolve(ROOT, 'contracts', 'soroban-spec.json')
const RUST_SOURCE_PATH = 'contracts/globe-wallet/src/lib.rs'

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const contractRepoIdx = args.indexOf('--contract-repo')
let contractRepoRoot = contractRepoIdx !== -1 ? args[contractRepoIdx + 1] : null

if (!contractRepoRoot) {
  // Default: look for sibling ../contract directory
  const sibling = resolve(ROOT, '..', 'contract')
  if (existsSync(sibling)) {
    contractRepoRoot = sibling
  }
}

// ── Load spec ───────────────────────────────────────────────────────────────

let spec
try {
  spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'))
} catch (err) {
  console.error(`FAIL: Could not load spec at ${SPEC_PATH}`)
  console.error(err.message)
  process.exit(1)
}

// ── Validate spec structure ─────────────────────────────────────────────────

const errors = []

function validateSpec() {
  if (!spec.contracts || typeof spec.contracts !== 'object') {
    errors.push('spec.contracts is missing or not an object')
    return
  }

  const gw = spec.contracts['globe-wallet']
  if (!gw) {
    errors.push('spec.contracts["globe-wallet"] is missing')
    return
  }

  if (!gw.methods || typeof gw.methods !== 'object') {
    errors.push('globe-wallet.methods is missing')
    return
  }

  // Validate each method has required fields
  for (const [name, method] of Object.entries(gw.methods)) {
    if (!method.parameters || !Array.isArray(method.parameters)) {
      errors.push(`globe-wallet.methods.${name}.parameters is not an array`)
    }
    if (!method.return) {
      errors.push(`globe-wallet.methods.${name}.return is missing`)
    }
    if (!method.auth) {
      errors.push(`globe-wallet.methods.${name}.auth is missing`)
    }
  }

  // Validate types
  if (!gw.types || typeof gw.types !== 'object') {
    errors.push('globe-wallet.types is missing')
  } else {
    if (!gw.types.AssetInfo) errors.push('globe-wallet.types.AssetInfo is missing')
    if (!gw.types.SpendRecord) errors.push('globe-wallet.types.SpendRecord is missing')
    if (!gw.types.WalletError) errors.push('globe-wallet.types.WalletError is missing')
  }
}

// ── Extract public functions from Rust source ──────────────────────────────

function extractPublicFunctions(rustSource) {
  const functions = new Map()

  // Match `pub fn name(` patterns within #[contractimpl] blocks
  // This handles multi-line signatures by looking for the closing `)`
  const pubFnRegex = /pub\s+fn\s+(\w+)\s*\(/g
  let match
  while ((match = pubFnRegex.exec(rustSource)) !== null) {
    const name = match[1]
    // Skip test helper functions and internal functions
    if (name === 'tests' || name.startsWith('test_')) continue

    // Extract the full signature up to the return type
    const startIdx = match.index
    const afterOpenParen = match.index + match[0].length

    // Find matching closing paren (handling nested parens)
    let depth = 1
    let i = afterOpenParen
    while (i < rustSource.length && depth > 0) {
      if (rustSource[i] === '(') depth++
      else if (rustSource[i] === ')') depth--
      i++
    }

    // Get everything from after the closing paren to the next `{` or `->`
    const afterParams = rustSource.slice(i, i + 200)
    const returnMatch = afterParams.match(/^(?:\s*->\s*([^\{]+))?\s*\{/)

    const params = rustSource.slice(afterOpenParen, i - 1).trim()
    const returnType = returnMatch ? returnMatch[1]?.trim() : null

    // Parse parameter names (simplified)
    const paramNames = []
    if (params) {
      // Split by comma, handle multi-line
      const paramParts = params.split(',').map(p => p.trim()).filter(Boolean)
      for (const part of paramParts) {
        // Skip env parameter
        if (part.startsWith('env:') || part.startsWith('env :')) continue
        const nameMatch = part.match(/^(\w+)\s*:/)
        if (nameMatch) {
          paramNames.push(nameMatch[1])
        }
      }
    }

    functions.set(name, {
      params: paramNames,
      returnType: returnType || 'void',
    })
  }

  return functions
}

// ── Compare spec vs source ─────────────────────────────────────────────────

function compareWithSource(sourceFunctions) {
  const specMethods = spec.contracts['globe-wallet'].methods
  const specNames = new Set(Object.keys(specMethods))
  const sourceNames = new Set(sourceFunctions.keys())

  // Check for methods in spec but not in source
  for (const name of specNames) {
    if (!sourceNames.has(name)) {
      // Some methods may be deprecated or internal — only warn, don't fail
      const method = specMethods[name]
      if (method.deprecated) continue
      errors.push(`DRIFT: Method "${name}" exists in spec but not in contract source`)
    }
  }

  // Check for methods in source but not in spec
  for (const name of sourceNames) {
    if (!specNames.has(name)) {
      // Internal helper functions (lowercase, start with _) are expected
      if (name.startsWith('_') || name === 'require_admin' || name === 'require_guardian'
        || name === 'require_recovery_configured' || name === 'require_pending_recovery') {
        continue
      }
      errors.push(`DRIFT: Method "${name}" exists in contract source but not in spec`)
    }
  }

    // Check parameter counts match for shared methods
    for (const name of specNames) {
      if (!sourceNames.has(name)) continue
      const sourceFn = sourceFunctions.get(name)
      const specMethod = specMethods[name]
      // Both exclude env: source extraction skips it, spec excludes it
      if (sourceFn.params.length !== specMethod.parameters.length) {
        errors.push(
          `DRIFT: Method "${name}" parameter count mismatch — `
          + `spec has ${specMethod.parameters.length}, source has ${sourceFn.params.length}`
        )
      }
    }
}

// ── Token-wrapper warning ───────────────────────────────────────────────────

function checkTokenWrapper() {
  const tw = spec.contracts['token-wrapper']
  if (!tw) return
  if (tw.status === 'BLOCKED') {
    console.log(
      '\n  NOTE: token-wrapper contract is marked BLOCKED in spec.\n'
      + `  Reason: ${tw.reason}\n`
      + '  Skipping token-wrapper synchronization checks.\n'
      + '  This will resume once the implementation is available upstream.\n'
    )
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log('Soroban contract synchronization check')
console.log('─'.repeat(50))

// 1. Validate spec structure
validateSpec()

if (errors.length > 0) {
  console.error('\nSpec validation errors:')
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}

console.log(`  ✓ Spec loaded: ${Object.keys(spec.contracts['globe-wallet'].methods).length} globe-wallet methods`)
console.log(`  ✓ Types validated: AssetInfo, SpendRecord, WalletError`)

// 2. Token-wrapper warning
checkTokenWrapper()

// 3. Source comparison (if contract repo is available)
if (contractRepoRoot) {
  const rustPath = resolve(contractRepoRoot, RUST_SOURCE_PATH)
  if (existsSync(rustPath)) {
    const rustSource = readFileSync(rustPath, 'utf8')
    const sourceFunctions = extractPublicFunctions(rustSource)
    console.log(`  ✓ Contract source loaded: ${sourceFunctions.size} public functions found`)

    compareWithSource(sourceFunctions)
  } else {
    console.log(`  ⚠ Contract source not found at ${rustPath}`)
    console.log('    Skipping source comparison (spec-only validation)')
  }
} else {
  console.log('  ⚠ Contract repo not available')
  console.log('    Skipping source comparison (spec-only validation)')
  console.log('    Tip: pass --contract-repo PATH to enable source comparison')
}

// 4. Report
console.log('')
if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} synchronization issue(s) found:`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('\nTo fix: update contracts/soroban-spec.json to match the contract source,')
  console.error('or update the contract source to match the spec.')
  process.exit(1)
} else {
  console.log('PASS: Specification is in sync.')
  process.exit(0)
}
