import { SorobanMockService } from '../../../lib/services/soroban.service.mock'
import { SorobanService } from '../../../lib/services/soroban.service'
import { FinanceServiceContainer } from '../../../lib/services/container'

describe('SorobanMockService', () => {
  let service: SorobanMockService

  beforeEach(() => {
    service = new SorobanMockService()
  })

  it('should be instantiable', () => {
    expect(service).toBeInstanceOf(SorobanMockService)
  })

  it('addAsset should return success', async () => {
    const result = await service.addAsset('GABC...', { code: 'XLM' })
    expect(result.success).toBe(true)
    expect(result.hash).toBeDefined()
  })

  it('removeAsset should return success', async () => {
    const result = await service.removeAsset('GABC...', { code: 'XLM' })
    expect(result.success).toBe(true)
  })

  it('getAssets should return an array', async () => {
    const assets = await service.getAssets('GABC...')
    expect(Array.isArray(assets)).toBe(true)
    expect(assets.length).toBeGreaterThan(0)
  })

  it('setSpendLimit should return success', async () => {
    const result = await service.setSpendLimit('GABC...', { code: 'XLM' }, BigInt(1_000_000))
    expect(result.success).toBe(true)
  })

  it('getSpendLimit should return a bigint', async () => {
    const limit = await service.getSpendLimit('GABC...', { code: 'XLM' })
    expect(typeof limit).toBe('bigint')
  })

  it('recordSpend should return success', async () => {
    const result = await service.recordSpend('GABC...', { code: 'XLM' }, BigInt(500))
    expect(result.success).toBe(true)
  })
})

describe('SorobanService (live)', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should throw a configuration error when env vars are missing', () => {
    delete process.env.SOROBAN_RPC_URL
    delete process.env.SOROBAN_CONTRACT_ID_GLOBE_WALLET

    const service = new SorobanService()

    expect(async () => {
      await service.addAsset('GABC...', { code: 'XLM' })
    }).rejects.toThrow('Live Soroban configuration is missing')
  })

  it('should throw a configuration error for any method when unconfigured', async () => {
    delete process.env.SOROBAN_RPC_URL
    delete process.env.SOROBAN_CONTRACT_ID_GLOBE_WALLET

    const service = new SorobanService()

    await expect(service.getAssets('GABC...')).rejects.toThrow('Live Soroban configuration is missing')
    await expect(service.getSpendLimit('GABC...', { code: 'XLM' })).rejects.toThrow('Live Soroban configuration is missing')
  })
})

describe('FinanceServiceContainer soroban', () => {
  it('should default to SorobanMockService in mock mode', () => {
    const container = new FinanceServiceContainer()
    expect(container.soroban).toBeInstanceOf(SorobanMockService)
  })

  it('should use SorobanMockService when explicitly set to mock', () => {
    const container = new FinanceServiceContainer(
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined,
      { environment: 'mock' }
    )
    expect(container.soroban).toBeInstanceOf(SorobanMockService)
  })

  it('should use SorobanService when set to live', () => {
    const container = new FinanceServiceContainer(
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined,
      { environment: 'live' }
    )
    expect(container.soroban).toBeInstanceOf(SorobanService)
  })

  it('should allow per-service override for soroban', () => {
    const container = new FinanceServiceContainer(
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined,
      { environment: 'live', services: { soroban: 'mock' } }
    )
    expect(container.soroban).toBeInstanceOf(SorobanMockService)
  })
})
