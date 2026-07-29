"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useBalances } from "@/hooks/useBalances"
import { formatCryptoAmount } from "@/lib/helpers/format"
import type { AssetCode } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TrustlineManager } from "./trustline-manager"
import { Button } from "@/components/ui/button"

const assetGlyph: Record<AssetCode, string> = {
  XLM: "✦",
  USDC: "$",
  USDT: "₮",
  NGN: "₦",
  USD: "$",
  EUR: "€",
}

export function CryptoHoldings() {
  const [hidden] = useState(false)
  const { assets, loading } = useBalances()

  return (
    <section className="px-4 pt-6" data-testid="crypto-holdings">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Crypto on Stellar</h2>
        <div className="flex items-center gap-3">
          <TrustlineManager>
            <Button variant="link" className="h-auto p-0 text-xs font-medium text-primary">
              Manage Trustlines
            </Button>
          </TrustlineManager>
          <Link href="/convert" className="flex items-center text-xs font-medium text-primary">
            Convert <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <Card className="divide-y divide-border p-0">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3" data-testid="crypto-holdings-skeleton">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-2 flex flex-col items-end">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : assets.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="crypto-holdings-empty">
            No crypto assets found.
          </div>
        ) : (
          assets.map((asset) => {
            const usdValue = asset.balance * asset.priceUsd
            const changePct = asset.changePct ?? asset.change24h ?? 0
            const up = changePct >= 0
            return (
              <div
                key={asset.code}
                className="flex items-center gap-3 px-4 py-3"
                data-testid={`asset-row-${asset.code}`}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-base font-bold",
                    asset.color === 'bg-accent' ? 'bg-accent text-accent-foreground dark:text-foreground' : cn('text-background', asset.color),
                  )}
                  aria-hidden
                >
                  {assetGlyph[asset.code] || "✦"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{asset.code}</p>
                  <p className="truncate text-xs text-muted-foreground">{asset.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCryptoAmount(asset.balance, asset.code, hidden)}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <span>${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className={cn("flex items-center gap-0.5", up ? "text-primary" : "text-destructive")}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(changePct)}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </Card>
    </section>
  )
}
