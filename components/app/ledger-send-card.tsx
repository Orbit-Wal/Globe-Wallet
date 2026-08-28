"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, Usb } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WalletErrorAlert } from "@/components/ui/wallet-error-alert"
import { ledgerService } from "@/lib/ledger/ledger.service"

type Step = "disconnected" | "connecting" | "connected" | "sending" | "success" | "error"

/**
 * Issue #92 — alternative signing path alongside the existing software-key
 * flow (send-form.tsx / STELLAR_SOURCE_SECRET_KEY). Instead of the server
 * signing with a configured secret key, this card walks a Ledger device
 * through: connect (WebHID) -> read public key -> build unsigned tx
 * server-side (/api/wallet/send/prepare) -> sign on-device -> submit
 * (/api/wallet/send/submit-signed). The private key never leaves the
 * device.
 *
 * XLM-only for now (Ledger's Stellar app) — Solana/Sui Ledger apps are a
 * TODO, noted in lib/ledger/ledger.service.ts.
 */
export function LedgerSendCard() {
  const [step, setStep] = useState<Step>("disconnected")
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)

  const handleConnect = async () => {
    setError(null)
    setStep("connecting")
    try {
      await ledgerService.connect()
      const pk = await ledgerService.getPublicKey(undefined, true)
      setPublicKey(pk)
      setStep("connected")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Ledger")
      setStep("error")
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey) return
    const parsedAmount = Number(amount)
    if (!destination.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return

    setError(null)
    setStep("sending")

    try {
      const prepareResponse = await fetch("/api/wallet/send/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer globe-wallet-client" },
        body: JSON.stringify({
          sourcePublicKey: publicKey,
          destination: destination.trim(),
          amount: parsedAmount,
          asset: "XLM",
        }),
      })
      const prepared = await prepareResponse.json()
      if (!prepareResponse.ok) throw new Error(prepared.error || "Failed to prepare transaction")

      const signature = await ledgerService.signTransaction(Buffer.from(prepared.signatureBase, "base64"))

      const submitResponse = await fetch("/api/wallet/send/submit-signed", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer globe-wallet-client" },
        body: JSON.stringify({
          xdr: prepared.xdr,
          publicKey,
          signature: signature.toString("base64"),
          networkPassphrase: prepared.networkPassphrase,
        }),
      })
      const result = await submitResponse.json()
      if (!submitResponse.ok || !result.success) {
        throw new Error(result.error || "Send failed")
      }

      setHash(result.hash ?? null)
      setStep("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ledger send failed")
      setStep("error")
    }
  }

  return (
    <div className="px-4 pt-6" data-testid="ledger-send-card">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Sign with Ledger (XLM)</h2>
      <Card className="mt-3 p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Alternative to the app&apos;s software-key signing — the private key never leaves your device.
        </p>

        {!publicKey ? (
          <Button onClick={handleConnect} disabled={step === "connecting"} data-testid="ledger-connect-btn">
            {step === "connecting" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Usb className="mr-2 h-4 w-4" aria-hidden />
            )}
            Connect Ledger
          </Button>
        ) : (
          <>
            <p className="mb-3 font-mono text-xs text-foreground" data-testid="ledger-public-key">
              {publicKey}
            </p>
            <form onSubmit={handleSend} className="space-y-2">
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Recipient G… address"
                aria-label="Recipient address"
                data-testid="ledger-send-destination"
              />
              <div className="flex gap-2">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount in XLM"
                  inputMode="decimal"
                  aria-label="Amount"
                  data-testid="ledger-send-amount"
                />
                <Button
                  type="submit"
                  disabled={step === "sending" || !destination.trim() || !amount.trim()}
                  data-testid="ledger-send-submit"
                >
                  {step === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Sign & Send"}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "error" && error && (
          <div className="mt-3">
            <WalletErrorAlert message={error} data-testid="ledger-send-error" />
          </div>
        )}

        {step === "success" && (
          <div
            className="mt-3 flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
            role="status"
            aria-live="polite"
            data-testid="ledger-send-success"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Send complete</p>
              {hash && <p className="font-mono text-xs opacity-80 break-all">{hash}</p>}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
