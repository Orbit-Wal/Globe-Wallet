import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SPEC_PATH = resolve(__dirname, '..', '..', '..', 'contracts', 'soroban-spec.json')

function loadSpec() {
  return JSON.parse(readFileSync(SPEC_PATH, 'utf8'))
}

describe('soroban-spec.json', () => {
  it('should load successfully', () => {
    const spec = loadSpec()
    expect(spec).toBeDefined()
    expect(spec.contracts).toBeDefined()
  })

  it('should have globe-wallet contract', () => {
    const spec = loadSpec()
    const gw = spec.contracts['globe-wallet']
    expect(gw).toBeDefined()
    expect(gw.name).toBe('GlobeWallet')
    expect(gw.methods).toBeDefined()
    expect(gw.types).toBeDefined()
  })

  it('should mark token-wrapper as BLOCKED', () => {
    const spec = loadSpec()
    const tw = spec.contracts['token-wrapper']
    expect(tw).toBeDefined()
    expect(tw.status).toBe('BLOCKED')
    expect(tw.reason).toContain('missing')
  })
})

describe('globe-wallet methods', () => {
  const REQUIRED_METHODS = [
    'initialize',
    'admin',
    'transfer_admin',
    'add_asset',
    'remove_asset',
    'get_assets',
    'set_spend_limit',
    'get_spend_limit',
    'record_spend',
    'migrate_user_assets',
  ]

  it.each(REQUIRED_METHODS)('should have method: %s', (name) => {
    const spec = loadSpec()
    expect(spec.contracts['globe-wallet'].methods[name]).toBeDefined()
  })

  it.each(REQUIRED_METHODS)('method %s should have parameters array', (name) => {
    const spec = loadSpec()
    expect(Array.isArray(spec.contracts['globe-wallet'].methods[name].parameters)).toBe(true)
  })

  it.each(REQUIRED_METHODS)('method %s should have a return type', (name) => {
    const spec = loadSpec()
    expect(spec.contracts['globe-wallet'].methods[name].return).toBeDefined()
    expect(spec.contracts['globe-wallet'].methods[name].return.type).toBeDefined()
  })

  it.each(REQUIRED_METHODS)('method %s should have auth field', (name) => {
    const spec = loadSpec()
    expect(spec.contracts['globe-wallet'].methods[name].auth).toBeDefined()
  })

  it('add_asset should have user and asset parameters', () => {
    const spec = loadSpec()
    const params = spec.contracts['globe-wallet'].methods.add_asset.parameters.map((p: { name: string }) => p.name)
    expect(params).toContain('user')
    expect(params).toContain('asset')
  })

  it('record_spend should have user, asset_code, and amount parameters', () => {
    const spec = loadSpec()
    const params = spec.contracts['globe-wallet'].methods.record_spend.parameters.map((p: { name: string }) => p.name)
    expect(params).toContain('user')
    expect(params).toContain('asset_code')
    expect(params).toContain('amount')
  })

  it('record_spend should list SpendLimitExceeded as an error', () => {
    const spec = loadSpec()
    expect(spec.contracts['globe-wallet'].methods.record_spend.errors).toContain('SpendLimitExceeded')
  })
})

describe('globe-wallet types', () => {
  it('should have AssetInfo type', () => {
    const spec = loadSpec()
    const gw = spec.contracts['globe-wallet']
    expect(gw.types.AssetInfo).toBeDefined()
    expect(gw.types.AssetInfo.fields.code).toBeDefined()
    expect(gw.types.AssetInfo.fields.issuer).toBeDefined()
  })

  it('should have SpendRecord type', () => {
    const spec = loadSpec()
    const gw = spec.contracts['globe-wallet']
    expect(gw.types.SpendRecord).toBeDefined()
    expect(gw.types.SpendRecord.fields.amount).toBeDefined()
    expect(gw.types.SpendRecord.fields.day).toBeDefined()
  })

  it('should have WalletError with at least 10 variants', () => {
    const spec = loadSpec()
    const gw = spec.contracts['globe-wallet']
    expect(gw.types.WalletError).toBeDefined()
    expect(gw.types.WalletError.variants).toBeDefined()
    expect(Object.keys(gw.types.WalletError.variants).length).toBeGreaterThanOrEqual(10)
  })

  it('WalletError should include SpendLimitExceeded', () => {
    const spec = loadSpec()
    expect(spec.contracts['globe-wallet'].types.WalletError.variants.SpendLimitExceeded).toBeDefined()
  })
})
