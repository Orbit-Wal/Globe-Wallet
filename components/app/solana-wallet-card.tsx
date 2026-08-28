"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { WalletErrorAlert } from "@/components/ui/wallet-error-alert"
import { useSolanaBalances, useSolanaSend } from "@/hooks/useSolanaWallet"

/**
 * Real, read-only balance lookups against Solana devnet RPC
 * (GET /api/solana/balance), plus a native SOL send form gated on the
 * server's SOLANA_SOURCE_PRIVATE_KEY being configured (POST /api/solana/send)
 * — mirrors components/app/evm-wallet-card.tsx's "not configured" handling
 * rather than fabricating a result.
 */
export function SolanaWalletCard() {
  const [address, setAddress] = useState("")
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("")

  const { balances, network, loading, error, fetchBalances } = useSolanaBalances()
  const send = useSolanaSend()

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    fetchBalances(address.trim())
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = Number(amount)
    if (!destination.trim() || !Number.isFinite(parsed) || parsed <= 0) return
    send.send(destination.trim(), parsed)
  }

  return (
    <div className="px-4 pt-6" data-testid="solana-wallet-card">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Solana (devnet)</h2>

      <Card className="mt-3 p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Solana Devnet &middot; live testnet balance lookup, no wallet connection required
        </p>

        <form onSubmit={handleCheck} className="flex gap-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Base58 address to check"
            aria-label="Solana address"
            data-testid="solana-address-input"
          />
          <Button type="submit" disabled={loading || !address.trim()} data-testid="solana-check-balance-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          </Button>
        </form>

        {error && (
          <div className="mt-3">
            <WalletErrorAlert message={error} data-testid="solana-balance-error" />
          </div>
        )}

        {loading && (
          <div className="mt-3 space-y-2" data-testid="solana-balance-loading">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-32" />
          </div>
        )}

        {!loading && balances.length > 0 && (
          <div className="mt-3 space-y-1" data-testid="solana-balance-list">
            <p className="text-xs text-muted-foreground">{network}</p>
            {balances.map((balance) => (
              <div
                key={balance.symbol}
                className="flex items-center justify-between text-sm"
                data-testid={`solana-balance-${balance.symbol}`}
              >
                <span className="font-medium text-foreground">{balance.symbol}</span>
                <span className="font-mono text-foreground">{balance.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Send SOL</p>
          <form onSubmit={handleSend} className="space-y-2">
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Recipient base58 address"
              aria-label="Recipient address"
              data-testid="solana-send-destination"
            />
            <div className="flex gap-2">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in SOL"
                inputMode="decimal"
                aria-label="Amount"
                data-testid="solana-send-amount"
              />
              <Button
                type="submit"
                disabled={send.status === "processing" || !destination.trim() || !amount.trim()}
                data-testid="solana-send-submit"
              >
                {send.status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Send"}
              </Button>
            </div>
          </form>

          {send.status === "error" && send.error && (
            <div className="mt-2">
              <WalletErrorAlert message={send.error} data-testid="solana-send-error" onRetry={send.reset} />
            </div>
          )}

          {send.status === "success" && send.result && (
            <div
              className="mt-2 flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
              role="status"
              aria-live="polite"
              data-testid="solana-send-success"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">
                  {send.result.status === "pending" ? "Submitted — awaiting confirmation" : "Send complete"}
                </p>
                {send.result.signature && (
                  <p className="font-mono text-xs opacity-80 break-all">{send.result.signature}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
