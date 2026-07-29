"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { WalletErrorAlert } from "@/components/ui/wallet-error-alert"
import { useEvmBalances, useEvmSend } from "@/hooks/useEvmWallet"
import { EVM_NETWORKS } from "@/lib/evm/networks"
import type { EvmChainId } from "@/lib/types"

const CHAINS: { id: EvmChainId; label: string }[] = [
  { id: "base", label: "Base" },
  { id: "ethereum", label: "Ethereum" },
]

/**
 * Real, read-only balance lookups against Base Sepolia / Ethereum Sepolia
 * testnet RPCs (GET /api/evm/balance), plus a native-currency send form
 * gated on the server's EVM_SOURCE_PRIVATE_KEY being configured
 * (POST /api/evm/send) — mirrors the Stellar send flow's "not configured"
 * handling rather than fabricating a result.
 */
export function EvmWalletCard() {
  const [chainId, setChainId] = useState<EvmChainId>("base")
  const [address, setAddress] = useState("")
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("")

  const { balances, network, loading, error, fetchBalances } = useEvmBalances()
  const send = useEvmSend()

  const network_config = EVM_NETWORKS[chainId]

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    fetchBalances(chainId, address.trim())
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = Number(amount)
    if (!destination.trim() || !Number.isFinite(parsed) || parsed <= 0) return
    send.send(chainId, destination.trim(), parsed)
  }

  return (
    <div className="px-4 pt-6" data-testid="evm-wallet-card">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Base &amp; Ethereum (testnet)</h2>

      <Tabs
        value={chainId}
        onValueChange={(value) => {
          setChainId(value as EvmChainId)
          send.reset()
        }}
      >
        <TabsList>
          {CHAINS.map((chain) => (
            <TabsTrigger key={chain.id} value={chain.id} data-testid={`evm-chain-${chain.id}`}>
              {chain.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="mt-3 p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          {network_config.name} &middot; live testnet balance lookup, no wallet connection required
        </p>

        <form onSubmit={handleCheck} className="flex gap-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x… address to check"
            aria-label="EVM address"
            data-testid="evm-address-input"
          />
          <Button type="submit" disabled={loading || !address.trim()} data-testid="evm-check-balance-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          </Button>
        </form>

        {error && (
          <div className="mt-3">
            <WalletErrorAlert message={error} data-testid="evm-balance-error" />
          </div>
        )}

        {loading && (
          <div className="mt-3 space-y-2" data-testid="evm-balance-loading">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-32" />
          </div>
        )}

        {!loading && balances.length > 0 && (
          <div className="mt-3 space-y-1" data-testid="evm-balance-list">
            <p className="text-xs text-muted-foreground">{network}</p>
            {balances.map((balance) => (
              <div
                key={balance.symbol}
                className="flex items-center justify-between text-sm"
                data-testid={`evm-balance-${balance.symbol}`}
              >
                <span className="font-medium text-foreground">{balance.symbol}</span>
                <span className="font-mono text-foreground">{balance.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Send {network_config.nativeCurrency.symbol}</p>
          <form onSubmit={handleSend} className="space-y-2">
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Recipient 0x… address"
              aria-label="Recipient address"
              data-testid="evm-send-destination"
            />
            <div className="flex gap-2">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Amount in ${network_config.nativeCurrency.symbol}`}
                inputMode="decimal"
                aria-label="Amount"
                data-testid="evm-send-amount"
              />
              <Button
                type="submit"
                disabled={send.status === "processing" || !destination.trim() || !amount.trim()}
                data-testid="evm-send-submit"
              >
                {send.status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Send"}
              </Button>
            </div>
          </form>

          {send.status === "error" && send.error && (
            <div className="mt-2">
              <WalletErrorAlert message={send.error} data-testid="evm-send-error" onRetry={send.reset} />
            </div>
          )}

          {send.status === "success" && send.result && (
            <div
              className="mt-2 flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
              role="status"
              aria-live="polite"
              data-testid="evm-send-success"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">
                  {send.result.status === "pending" ? "Submitted — awaiting confirmation" : "Send complete"}
                </p>
                {send.result.hash && (
                  <p className="font-mono text-xs opacity-80 break-all">{send.result.hash}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
