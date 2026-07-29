'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { useTransactions } from '../../hooks/useTransactions'
import { Transaction, TransactionCategory, TransactionDirection } from '../../lib/types'
import {
  getTransactionDirection,
  getTransactionDisplayName,
  getTransactionDetail,
  getTransactionCategory,
} from '../../lib/transaction-utils'
import { ArrowUpRight, ArrowDownLeft, Filter } from 'lucide-react'
import { Skeleton } from '../ui/skeleton'

interface TransactionListProps {
  limit?: number
  showFilters?: boolean
  className?: string
}

export function TransactionList({ limit = 10, showFilters = true, className }: TransactionListProps) {
  const {
    getTransactions,
    formatTransactionAmount,
    loading,
    hasError,
    error,
  } = useTransactions()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filter, setFilter] = useState<{ type?: TransactionDirection; category?: TransactionCategory }>({})

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const data = await getTransactions(filter as any)
        setTransactions(data.slice(0, limit))
      } catch (err) {
        console.error('Failed to load transactions:', err)
      }
    }
    loadTransactions()
  }, [getTransactions, filter, limit])

  const handleFilterChange = (key: 'type' | 'category', value: string) => {
    setFilter((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : (value as TransactionDirection & TransactionCategory),
    }))
  }

  if (loading) {
    return (
      <Card className={className} data-testid="transaction-list-loading">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card className={className} data-testid="transaction-list-error">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Failed to load transactions
            </p>
            <p className="text-xs text-destructive mt-1">{error?.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className} data-testid="transaction-list">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Recent Transactions</CardTitle>
        {showFilters && (
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-muted-foreground" aria-hidden />
            <Select onValueChange={(value) => handleFilterChange('type', value)}>
              <SelectTrigger className="w-24 h-8" aria-label="Filter by transaction type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in">Income</SelectItem>
                <SelectItem value="out">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger className="w-28 h-8" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="bills">Bills</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No transactions found
            </p>
          ) : (
            transactions.map((transaction) => {
              const direction = getTransactionDirection(transaction)
              const name = getTransactionDisplayName(transaction)
              const detail = getTransactionDetail(transaction)
              const category = getTransactionCategory(transaction)

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                  data-testid={`transaction-${transaction.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      direction === 'in'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {direction === 'in' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        {detail} • {transaction.date}
                      </div>
                    </div>
                  </div>
                  <div className={`text-right ${
                    direction === 'in' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                  }`}>
                    <div className="font-medium text-sm">
                      {direction === 'in' ? '+' : '-'}
                      {formatTransactionAmount(transaction)}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {category}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {transactions.length > 0 && transactions.length === limit && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm">
              View All Transactions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
