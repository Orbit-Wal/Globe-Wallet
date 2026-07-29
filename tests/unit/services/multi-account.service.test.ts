import { WalletService } from '../../../lib/services/wallet.service'
import { StellarService } from '../../../lib/services/stellar.service'
import { WalletServiceError, StellarServiceError } from '../../../lib/types'
import {
  TEST_STELLAR_ADDRESS,
  SECONDARY_STELLAR_ADDRESS,
} from '../../../lib/fixtures'
import { db } from '../../../lib/db/mock-db'

describe('multi-account service layer', () => {
  let wallet: WalletService
  let stellar: StellarService

  beforeEach(async () => {
    wallet = new WalletService()
    stellar = new StellarService()
    const accounts = await db.listAccounts()
    const primary = accounts.find((a) => a.isPrimary)!
    await db.setActiveAccount(primary.id)
  })

  describe('WalletService', () => {
    it('defaults getAccountInfo to the primary/active account', () => {
      const account = wallet.getAccountInfo()
      expect(account.publicKey).toBe(TEST_STELLAR_ADDRESS)
      expect(account.name).toBe('Primary Wallet')
      expect(account.id).toBeTruthy()
    })

    it('returns account info for an explicit accountId', () => {
      const accounts = wallet.listAccounts()
      const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!
      const info = wallet.getAccountInfo(secondary.id)
      expect(info.publicKey).toBe(SECONDARY_STELLAR_ADDRESS)
      expect(info.name).toBe('Savings Wallet')
      expect(info.id).toBe(secondary.id)
    })

    it('lists multiple accounts for the user', () => {
      const accounts = wallet.listAccounts()
      expect(accounts.length).toBeGreaterThanOrEqual(2)
    })

    it('switches the active account used by default', () => {
      const accounts = wallet.listAccounts()
      const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!
      wallet.switchAccount(secondary.id)
      expect(wallet.getActiveAccountId()).toBe(secondary.id)
      expect(wallet.getAccountInfo().publicKey).toBe(SECONDARY_STELLAR_ADDRESS)
      expect(wallet.generateReceiveAddress()).toBe(SECONDARY_STELLAR_ADDRESS)
    })

    it('generateReceiveAddress respects accountId without switching', () => {
      const accounts = wallet.listAccounts()
      const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!
      expect(wallet.generateReceiveAddress(secondary.id)).toBe(SECONDARY_STELLAR_ADDRESS)
      expect(wallet.getAccountInfo().publicKey).toBe(TEST_STELLAR_ADDRESS)
    })

    it('throws when switching to an unknown account', () => {
      expect(() => wallet.switchAccount('nope')).toThrow(WalletServiceError)
    })

    it('throws when resolving an unknown accountId', () => {
      expect(() => wallet.getAccountInfo('nope')).toThrow(WalletServiceError)
    })
  })

  describe('StellarService', () => {
    it('defaults getAccountInfo to the primary/active account', () => {
      const account = stellar.getAccountInfo()
      expect(account.publicKey).toBe(TEST_STELLAR_ADDRESS)
    })

    it('accepts an account identifier', () => {
      const accounts = stellar.listAccounts()
      const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!
      expect(stellar.getAccountInfo(secondary.id).publicKey).toBe(SECONDARY_STELLAR_ADDRESS)
    })

    it('switches active account', () => {
      const accounts = stellar.listAccounts()
      const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!
      stellar.switchAccount(secondary.id)
      expect(stellar.generateReceiveAddress()).toBe(SECONDARY_STELLAR_ADDRESS)
    })

    it('throws for unknown account ids', () => {
      expect(() => stellar.switchAccount('missing')).toThrow(StellarServiceError)
    })
  })
})
