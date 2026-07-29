'use client'

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useBalances } from '../../hooks/useBalances'
import { Skeleton } from '../ui/skeleton'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'

interface BalanceCardProps {
  title: string
  showTotal?: boolean
  className?: string
}

export function BalanceCard({ title, showTotal = false, className }: BalanceCardProps) {
  const { 
    wallets, 
    assets, 
    totalFiatValue, 
    totalCryptoValue, 
    loading, 
    hasError, 
    refreshBalances,
    getTotalValue 
  } = useBalances()

  if (loading) {
    return (
      <Card className={className} data-testid="balance-card-loading">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (hasError) {
    return (
      <Card className={className} data-testid="balance-card-error">
        <CardHeader>
          <CardTitle className="text-destructive">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Failed to load balance data
          </p>
          <Button 
            onClick={refreshBalances} 
            size="sm" 
            variant="outline"
            data-testid="retry-button"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totalValue = getTotalValue()

  return (
    <Card className={className} data-testid="balance-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Button 
          onClick={refreshBalances} 
          size="sm" 
          variant="ghost"
          data-testid="refresh-button"
          aria-label="Refresh balances"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {showTotal && (
          <div className="mb-4">
            <div className="text-2xl font-bold" data-testid="total-value">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total Portfolio Value</p>
          </div>
        )}
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fiat Wallets</span>
              <span className="text-sm font-medium" data-testid="fiat-total">
                ${totalFiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-1 space-y-1">
              {wallets.map((wallet) => (
                <div key={wallet.code} className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    {wallet.symbol || ''} {wallet.code}
                    {(wallet.changePct ?? 0) > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-700 dark:text-emerald-400 ml-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-700 dark:text-red-400 ml-1" />
                    )}
                  </span>
                  <span>{wallet.symbol || ''}{wallet.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Crypto Assets</span>
              <span className="text-sm font-medium" data-testid="crypto-total">
                ${totalCryptoValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-1 space-y-1">
              {assets.map((asset) => (
                <div key={asset.code} className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    {asset.code}
                    {(asset.changePct ?? 0) > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-700 dark:text-emerald-400 ml-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-700 dark:text-red-400 ml-1" />
                    )}
                  </span>
                  <span>{asset.balance.toLocaleString()} {asset.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}