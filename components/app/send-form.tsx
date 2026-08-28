"use client";

import { useState, useMemo, useId } from "react";
import {
  Send,
  CheckCircle2,
  Loader2,
  Coins,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WalletErrorAlert } from "@/components/ui/wallet-error-alert";
import { TransactionStatusBadge } from "@/components/ui/transaction-status-badge";
import { ContactPicker } from "@/components/ui/contact-picker";
import { AddressLookupBadge } from "@/components/ui/address-lookup-badge";
import { SendSummary } from "@/components/dashboard/send-summary";
import { usePricing, useWallet } from "@/hooks/useFinanceServices";
import { useBalances } from "@/hooks/useBalances";
import { useContacts } from "@/hooks/useContacts";
import { useWalletSend } from "@/hooks/useWalletSend";
import { useAddressLookup } from "@/hooks/useAddressLookup";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateFee } from "@/lib/helpers/format";
import { isFederatedAddress } from "@/lib/helpers/send-utils";
import { useTranslations } from "next-intl";
import type { AssetCode, SendConfirmation } from "@/lib/types";
import {
  addOptimisticTransaction,
  removeOptimisticTransaction,
  settleOptimisticTransaction,
} from "@/lib/state/optimistic-transactions";

export function SendForm() {
  const t = useTranslations();
  const { validateAddress } = useWallet();
  const { send, isProcessing, status, error, result, reset } = useWalletSend();
  const { formatAsset } = usePricing();
  const { assets, loading: balancesLoading } = useBalances();
  const contactsState = useContacts();
  // Issue #94: sending real funds while offline would just fail silently
  // (or hang) — disable the action explicitly instead, with a visible reason.
  const isOnline = useOnlineStatus();

  const [step, setStep] = useState<"form" | "confirm">("form");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetCode>("XLM");
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<SendConfirmation | null>(
    null,
  );

  const addressId = useId();
  const addressErrorId = useId();
  const amountId = useId();
  const memoId = useId();

  // Federation lookup — only active when user typed directly (no contact selected)
  const lookupInput = contactsState.selected ? "" : address;
  const lookupResult = useAddressLookup(lookupInput);

  // Resolve the effective destination address
  // Priority: selected contact → federation-resolved key → raw typed address
  const effectiveAddress = useMemo(() => {
    if (contactsState.selected?.address) return contactsState.selected.address;
    if (lookupResult.status === "resolved" && lookupResult.resolved)
      return lookupResult.resolved;
    return address;
  }, [contactsState.selected, lookupResult, address]);

  const currentAssetBalance = useMemo(
    () => assets.find((a) => a.code === selectedAsset)?.balance ?? 0,
    [assets, selectedAsset],
  );

  const estimatedFee = useMemo(
    () => calculateFee(parseFloat(amount) || 0),
    [amount],
  );

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    reset();

    // If user typed a federated address, guard against in-flight or failed lookups
    if (!contactsState.selected && isFederatedAddress(address)) {
      if (lookupResult.status === "resolving") {
        setFormError(t("common.addressResolving"));
        return;
      }
      if (lookupResult.status === "not-found") {
        setFormError(t("common.noFederationRecord"));
        return;
      }
      if (lookupResult.status === "error") {
        setFormError(lookupResult.error ?? t("common.addressLookupFailed"));
        return;
      }
    }

    if (!validateAddress(effectiveAddress)) {
      setFormError(t("common.invalidStellarAddress"));
      return;
    }

    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setFormError(t("common.invalidAmount"));
      return;
    }

    if (
      !balancesLoading &&
      assets.some((a) => a.code === selectedAsset) &&
      numAmount > currentAssetBalance
    ) {
      setFormError(`${t("common.insufficientBalance")} ${selectedAsset}`);
      return;
    }

    setConfirmation({
      recipient: effectiveAddress,
      recipientLabel: contactsState.selected?.name,
      amount: numAmount,
      asset: selectedAsset,
      memo: memo || undefined,
      estimatedFee,
      // Carry federation metadata into the confirmation summary
      federatedInput: isFederatedAddress(address) ? address : undefined,
      federationMemo:
        lookupResult.status === "resolved"
          ? lookupResult.federationMemo
          : undefined,
    });
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!confirmation) return;
    setFormError(null);

    // Issue #91: append an optimistic "pending" transaction entry to the
    // shared store immediately, before the real send resolves — so any
    // transaction list rendered elsewhere reflects the attempt right away
    // instead of waiting on network latency. Rolled back below if the real
    // send fails; settled in place (and later reconciled against the
    // stream-confirmed transaction by hash, see useTransactions.ts) if it
    // succeeds.
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    addOptimisticTransaction({
      id: optimisticId,
      type: "send",
      amount: confirmation.amount,
      asset: confirmation.asset,
      address: confirmation.recipient,
      date: new Date().toISOString(),
      status: "pending",
      category: "payment",
      name: `${confirmation.asset} Sent`,
      detail: confirmation.recipientLabel ?? confirmation.recipient,
      currency: undefined,
    });

    const txResult = await send(
      confirmation.recipient,
      String(confirmation.amount),
      confirmation.asset,
      confirmation.memo,
    );

    if (txResult && txResult.success) {
      settleOptimisticTransaction(optimisticId, {
        status: txResult.status ?? "completed",
        stellarHash: txResult.hash,
      });
    } else {
      // Rollback: remove the optimistic entry entirely. The existing error
      // UI (WalletErrorAlert bound to `error`/`activeError` below) already
      // surfaces the failure — nothing else to do here.
      removeOptimisticTransaction(optimisticId);
    }
  };

  const handleReset = () => {
    setAddress("");
    setAmount("");
    setMemo("");
    setFormError(null);
    setConfirmation(null);
    setStep("form");
    contactsState.select(null);
    reset();
  };

  const activeError =
    step === "form" ? formError : status === "error" ? error : null;

  if (status === "success" && result) {
    // A "pending" outcome means the transaction was signed and broadcast but
    // Horizon hadn't confirmed inclusion in a ledger before we heard back —
    // it is not yet a confirmed success. Reflect that distinctly rather than
    // always claiming "Send Complete" (Issue #63).
    const isPending = result.status === "pending";

    return (
      <Card
        className="w-full max-w-md border-primary/20 shadow-2xl bg-card/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500"
        data-testid="send-form-card"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isPending ? (
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden />
            )}
            {isPending ? t("common.sendSubmitted") : t("common.sendComplete")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            role="status"
            aria-live="polite"
            data-testid="send-success"
            className={
              isPending
                ? "p-3 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm flex flex-col gap-1"
                : "p-3 rounded-md bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-sm flex flex-col gap-1"
            }
          >
            <span className="font-semibold flex items-center gap-2">
              {isPending
                ? t("common.transactionAwaitingConfirmation")
                : t("common.transactionSuccessful")}
              {result.status && <TransactionStatusBadge status={result.status} />}
            </span>
            {result.hash && (
              <span className="text-xs opacity-80 font-mono break-all">
                Hash: {result.hash.slice(0, 20)}…
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            className="w-full"
            onClick={handleReset}
            data-testid="send-again-btn"
          >
            {t("common.sendAnother")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card
      className="w-full max-w-md border-primary/20 shadow-2xl bg-card/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500"
      data-testid="send-form-card"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {step === "confirm" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 mr-1"
              aria-label={t("common.backToForm")}
              data-testid="back-button"
              onClick={() => {
                setStep("form");
                setFormError(null);
                reset();
              }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
          )}
          <Send className="w-5 h-5 text-primary" aria-hidden />
          {step === "confirm" ? t("common.confirmSend") : t("common.sendAssets")}
        </CardTitle>
        <CardDescription>
          {step === "confirm"
            ? t("common.reviewDetails")
            : t("common.transferXlm")}
        </CardDescription>
      </CardHeader>

      {step === "form" ? (
        <form
          onSubmit={handleReview}
          aria-label="Send payment form"
          noValidate
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.quickSelectContact")}</label>
              <ContactPicker
                contacts={contactsState.contacts}
                selected={contactsState.selected}
                query={contactsState.query}
                onQueryChange={contactsState.setQuery}
                onSelect={contactsState.select}
              />
            </div>

            {!contactsState.selected?.address && (
              <div className="space-y-1">
                <label htmlFor={addressId} className="text-sm font-medium">
                  {t("common.recipientAddress")}
                </label>
                <Input
                  id={addressId}
                  data-testid="address-input"
                  placeholder={t("common.recipientPlaceholder")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-background/50"
                  aria-invalid={!!formError || undefined}
                  aria-describedby={formError ? addressErrorId : undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
                <AddressLookupBadge result={lookupResult} className="mt-1" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <label htmlFor={amountId} className="text-sm font-medium">
                  {t("common.amount")}
                </label>
                <Input
                  id={amountId}
                  data-testid="amount-input"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" id="asset-select-label">
                  {t("send.asset")}
                </label>
                <Select
                  value={selectedAsset}
                  onValueChange={(v) => setSelectedAsset(v as AssetCode)}
                >
                  <SelectTrigger
                    className="bg-background/50"
                    aria-labelledby="asset-select-label"
                    data-testid="asset-select"
                  >
                    <SelectValue placeholder={t("send.asset")} />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem
                        key={asset.code}
                        value={asset.code}
                        data-testid={`asset-option-${asset.code}`}
                      >
                        <div className="flex items-center gap-2">
                          <Coins
                            className="w-4 h-4 text-primary"
                            aria-hidden
                          />
                          {asset.code}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>
                {t("common.balance")}:{" "}
                <span data-testid="current-balance">
                  {formatAsset(currentAssetBalance, selectedAsset)}
                </span>
              </span>
              {parseFloat(amount) > 0 && (
                <span data-testid="fee-estimate">
                  {t("common.estFee")}: {estimatedFee.toFixed(6)} {selectedAsset}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor={memoId}
                className="text-sm font-medium text-muted-foreground"
              >
                {t("common.memoOptional")}
              </label>
              <Input
                id={memoId}
                data-testid="memo-input"
                placeholder={t("common.transactionNote")}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="bg-background/50 h-8 text-sm"
              />
            </div>

            {formError && (
              <WalletErrorAlert
                id={addressErrorId}
                message={formError}
                data-testid="send-error"
              />
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            {!isOnline && (
              <p
                className="w-full text-center text-xs text-amber-600 dark:text-amber-400"
                data-testid="send-offline-notice"
              >
                {t("common.offlineSendDisabled")}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              data-testid="review-button"
              disabled={!isOnline}
            >
              <Send className="w-4 h-4 mr-2" aria-hidden />
              {t("common.review")}
            </Button>
          </CardFooter>
        </form>
      ) : (
        <div>
          <CardContent className="space-y-4">
            {confirmation && <SendSummary confirmation={confirmation} />}
            {activeError && (
              <WalletErrorAlert
                message={activeError}
                data-testid="send-error"
                onRetry={() => {
                  setStep("form");
                  reset();
                }}
              />
            )}
            {!isOnline && (
              <p
                className="text-center text-xs text-amber-600 dark:text-amber-400"
                data-testid="send-offline-notice"
              >
                {t("common.offlineSendDisabled")}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              type="button"
              className="flex-1 group relative overflow-hidden"
              disabled={isProcessing || !isOnline}
              data-testid="confirm-send-button"
              aria-busy={isProcessing}
              onClick={handleConfirm}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
                  {t("common.processing")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" aria-hidden />
                  {t("common.confirmSend")}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleReset}
              aria-label={t("common.resetForm")}
              data-testid="reset-btn"
            >
              <RefreshCw className="w-4 h-4" aria-hidden />
            </Button>
          </CardFooter>
        </div>
      )}
    </Card>
  );
}
