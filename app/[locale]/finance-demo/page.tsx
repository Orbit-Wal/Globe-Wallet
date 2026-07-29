'use client'

import { FinanceServicesProvider } from '../../hooks/useFinanceServices'
import { BalanceCard } from '../../components/finance/BalanceCard'
import { TransactionList } from '../../components/finance/TransactionList'
import { CryptoConverter } from '../../components/finance/CryptoConverter'

export default function FinanceDemoPage() {
  return (
    <FinanceServicesProvider>
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Finance Services Demo</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BalanceCard title="Portfolio Balance" showTotal />
          <CryptoConverter />
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <TransactionList limit={10} />
        </div>
        
        <div className="text-sm text-muted-foreground">
          This demo showcases the refactored finance services with:
          <ul className="list-disc list-inside mt-2">
            <li>Modular service architecture (AssetService, FiatService, StellarService)</li>
            <li>React hooks integration</li>
            <li>Error handling and loading states</li>
            <li>Accessibility features</li>
            <li>Type-safe operations</li>
          </ul>
        </div>
      </div>
    </FinanceServicesProvider>
  )
}