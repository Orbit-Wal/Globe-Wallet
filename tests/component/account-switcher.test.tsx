import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { AccountSwitcher } from '../../components/app/account-switcher'
import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { ActiveAccountProvider, useActiveAccount } from '../../hooks/useActiveAccount'
import { FinanceServiceContainer } from '../../lib/services/container'
import { WalletService } from '../../lib/services/wallet.service'
import { TEST_STELLAR_ADDRESS, SECONDARY_STELLAR_ADDRESS } from '../../lib/fixtures'
import { db } from '../../lib/db/mock-db'

function ActiveKey() {
  const { activeAccount } = useActiveAccount()
  return <p data-testid="active-key">{activeAccount.publicKey}</p>
}

function renderSwitcher() {
  const services = new FinanceServiceContainer(new WalletService())
  return render(
    <FinanceServicesProvider services={services}>
      <ActiveAccountProvider>
        <AccountSwitcher />
      </ActiveAccountProvider>
    </FinanceServicesProvider>,
  )
}

describe('AccountSwitcher', () => {
  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch
    const accounts = await db.listAccounts()
    const primary = accounts.find((a) => a.isPrimary)!
    await db.setActiveAccount(primary.id)
  })

  it('renders the switcher trigger', () => {
    renderSwitcher()
    expect(screen.getByTestId('account-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('account-switcher-trigger')).toBeInTheDocument()
  })

  it('lists accounts and switches the active wallet', async () => {
    const user = userEvent.setup()
    const wallet = new WalletService()
    const services = new FinanceServiceContainer(wallet)

    render(
      <FinanceServicesProvider services={services}>
        <ActiveAccountProvider>
          <AccountSwitcher />
          <ActiveKey />
        </ActiveAccountProvider>
      </FinanceServicesProvider>,
    )

    expect(screen.getByTestId('active-key')).toHaveTextContent(TEST_STELLAR_ADDRESS)

    const accounts = wallet.listAccounts()
    const secondary = accounts.find((a) => a.publicKey === SECONDARY_STELLAR_ADDRESS)!
    await user.selectOptions(screen.getByTestId('account-switcher-trigger'), secondary.id)

    expect(screen.getByTestId('active-key')).toHaveTextContent(SECONDARY_STELLAR_ADDRESS)
    expect(wallet.getAccountInfo().publicKey).toBe(SECONDARY_STELLAR_ADDRESS)
  })
})
