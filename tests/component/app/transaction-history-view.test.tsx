import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TransactionHistoryView } from '../../../components/app/transaction-history-view'

const MOCK_PAGE = {
  data: [
    {
      id: 't1',
      type: 'receive',
      amount: 75000,
      asset: 'XLM',
      address: 'GDXSPAY...',
      date: 'Today, 09:42',
      status: 'completed',
      category: 'deposit',
      name: 'Received XLM',
    },
    {
      id: 't2',
      type: 'send',
      amount: 2000,
      asset: 'XLM',
      address: 'GDXSPAY...',
      date: 'Today, 08:15',
      status: 'pending',
      category: 'payment',
      name: 'Sent XLM',
    },
  ],
  total: 2,
  offset: 0,
  limit: 20,
  hasMore: false,
}

const MOCK_SYNC_STATUS = {
  lastSyncAt: null,
  isSyncing: false,
  totalSynced: 0,
  pendingCount: 0,
}

jest.mock('../../../hooks/useTransactionHistory', () => ({
  useTransactionHistory: jest.fn(() => ({
    transactions: MOCK_PAGE.data,
    total: MOCK_PAGE.total,
    hasMore: MOCK_PAGE.hasMore,
    loading: false,
    error: null,
    syncStatus: MOCK_SYNC_STATUS,
    syncing: false,
    page: MOCK_PAGE,
    filters: { limit: 20, offset: 0 },
    setSearch: jest.fn(),
    setTypeFilter: jest.fn(),
    setCategoryFilter: jest.fn(),
    setPage: jest.fn(),
    nextPage: jest.fn(),
    prevPage: jest.fn(),
    refresh: jest.fn(),
    sync: jest.fn(),
    addTransaction: jest.fn(),
  })),
}))

const { useTransactionHistory } = require('../../../hooks/useTransactionHistory')

describe('TransactionHistoryView', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the view container', () => {
    render(<TransactionHistoryView />)
    expect(screen.getByTestId('transaction-history-view')).toBeInTheDocument()
  })

  it('renders transaction stats card', () => {
    render(<TransactionHistoryView />)
    expect(screen.getByTestId('transaction-stats')).toBeInTheDocument()
    expect(screen.getByTestId('transaction-stats-total')).toHaveTextContent('2')
  })

  it('renders search input with correct aria-label', () => {
    render(<TransactionHistoryView />)
    expect(screen.getByRole('textbox', { name: /search transactions/i })).toBeInTheDocument()
  })

  it('renders type filter tabs', () => {
    render(<TransactionHistoryView />)
    expect(screen.getByTestId('tab-all')).toBeInTheDocument()
    expect(screen.getByTestId('tab-in')).toBeInTheDocument()
    expect(screen.getByTestId('tab-out')).toBeInTheDocument()
  })

  it('renders both transaction items', () => {
    render(<TransactionHistoryView />)
    const items = screen.getAllByTestId('transaction-item')
    expect(items).toHaveLength(2)
  })

  it('shows transaction names', () => {
    render(<TransactionHistoryView />)
    expect(screen.getByText('Received XLM')).toBeInTheDocument()
    expect(screen.getByText('Sent XLM')).toBeInTheDocument()
  })

  it('calls setSearch when search input changes', async () => {
    const setSearch = jest.fn()
    useTransactionHistory.mockReturnValue({
      ...useTransactionHistory(),
      setSearch,
    })
    render(<TransactionHistoryView />)
    const input = screen.getByRole('textbox', { name: /search transactions/i })
    fireEvent.change(input, { target: { value: 'xlm' } })
    await waitFor(() => expect(setSearch).toHaveBeenCalledWith('xlm'))
  })

  it('calls setTypeFilter when tab is clicked', async () => {
    const setTypeFilter = jest.fn()
    useTransactionHistory.mockReturnValue({
      ...useTransactionHistory(),
      setTypeFilter,
    })
    render(<TransactionHistoryView />)
    fireEvent.click(screen.getByTestId('tab-in'))
    await waitFor(() => expect(setTypeFilter).toHaveBeenCalledWith('in'))
  })

  it('shows empty state when transactions are empty', () => {
    useTransactionHistory.mockReturnValue({
      ...useTransactionHistory(),
      transactions: [],
      total: 0,
    })
    render(<TransactionHistoryView />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('shows error message when error is set', () => {
    useTransactionHistory.mockReturnValue({
      ...useTransactionHistory(),
      error: 'Network error',
    })
    render(<TransactionHistoryView />)
    expect(screen.getByRole('alert')).toHaveTextContent('Network error')
  })

  it('shows loading skeleton when loading', () => {
    useTransactionHistory.mockReturnValue({
      ...useTransactionHistory(),
      loading: true,
      transactions: [],
    })
    render(<TransactionHistoryView />)
    const list = screen.getByRole('list', { name: /transaction list/i })
    expect(list).toHaveAttribute('aria-busy', 'true')
  })

  it('sync button calls sync handler', async () => {
    const sync = jest.fn()
    useTransactionHistory.mockReturnValue({
      ...useTransactionHistory(),
      sync,
    })
    render(<TransactionHistoryView />)
    const syncBtn = screen.getByTestId('sync-button')
    fireEvent.click(syncBtn)
    await waitFor(() => expect(sync).toHaveBeenCalled())
  })

  it('renders status badges on each transaction', () => {
    useTransactionHistory.mockReturnValue({
      transactions: MOCK_PAGE.data,
      total: MOCK_PAGE.total,
      hasMore: MOCK_PAGE.hasMore,
      loading: false,
      error: null,
      syncStatus: MOCK_SYNC_STATUS,
      syncing: false,
      page: MOCK_PAGE,
      filters: { limit: 20, offset: 0 },
      setSearch: jest.fn(),
      setTypeFilter: jest.fn(),
      setCategoryFilter: jest.fn(),
      setPage: jest.fn(),
      nextPage: jest.fn(),
      prevPage: jest.fn(),
      refresh: jest.fn(),
      sync: jest.fn(),
      addTransaction: jest.fn(),
    })
    render(<TransactionHistoryView />)
    const badges = screen.getAllByTestId('transaction-status-badge')
    expect(badges.length).toBe(2)
    expect(badges[0]).toHaveAttribute('data-status', 'completed')
    expect(badges[1]).toHaveAttribute('data-status', 'pending')

    // Verify accessibility requirements for async status updates (Issue #88)
    expect(badges[0]).toHaveAttribute('aria-live', 'polite')
    expect(badges[1]).toHaveAttribute('aria-live', 'polite')
  })
})
