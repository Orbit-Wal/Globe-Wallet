/**
 * @jest-environment node
 */
import { db } from '../../../lib/db/mock-db'
import { TEST_STELLAR_ADDRESS, SECONDARY_STELLAR_ADDRESS } from '../../../lib/fixtures'

describe('MockDB multi-account', () => {
  it('seeds multiple accounts for the default user', async () => {
    const accounts = await db.listAccounts()
    expect(accounts.length).toBeGreaterThanOrEqual(2)
    expect(accounts.some((a) => a.publicKey === TEST_STELLAR_ADDRESS)).toBe(true)
    expect(accounts.some((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)).toBe(true)
  })

  it('marks exactly one primary and one active account by default', async () => {
    const accounts = await db.listAccounts()
    expect(accounts.filter((a) => a.isPrimary)).toHaveLength(1)
    expect(accounts.filter((a) => a.isActive)).toHaveLength(1)
    const primary = accounts.find((a) => a.isPrimary)!
    expect(primary.publicKey).toBe(TEST_STELLAR_ADDRESS)
    expect(primary.isActive).toBe(true)
  })

  it('resolves active/primary when accountId is omitted', async () => {
    const resolved = await db.resolveAccount()
    expect(resolved.publicKey).toBe(TEST_STELLAR_ADDRESS)
    expect(resolved.isPrimary).toBe(true)
  })

  it('resolves a specific account by id', async () => {
    const accounts = await db.listAccounts()
    const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!
    const resolved = await db.resolveAccount(secondary.id)
    expect(resolved.id).toBe(secondary.id)
    expect(resolved.publicKey).toBe(SECONDARY_STELLAR_ADDRESS)
  })

  it('throws for unknown account ids', async () => {
    await expect(db.resolveAccount('missing-account-id')).rejects.toThrow(/Unknown wallet account/)
  })

  it('switches the active account', async () => {
    const accounts = await db.listAccounts()
    const secondary = accounts.find((a) => !a.isPrimary)!
    const switched = await db.setActiveAccount(secondary.id)
    expect(switched.id).toBe(secondary.id)
    expect(switched.isActive).toBe(true)

    const active = await db.getActiveAccount()
    expect(active?.id).toBe(secondary.id)

    const primary = accounts.find((a) => a.isPrimary)!
    await db.setActiveAccount(primary.id)
    const restored = await db.getActiveAccount()
    expect(restored?.id).toBe(primary.id)
  })

  it('rejects switching to an unknown account', async () => {
    await expect(db.setActiveAccount('ghost-id')).rejects.toThrow(/Unknown wallet account/)
  })
})
