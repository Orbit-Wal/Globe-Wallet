"use client";

import { Building2, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PayoutSummary } from "@/components/dashboard/PayoutSummary";
import { FeeDisplay } from "@/components/ui/FeeDisplay";
import type { UseOffRampReturn } from "@/hooks/useOffRamp";
import type { OffRampPaymentMethod, PayoutBreakdown } from "@/lib/off-ramp-utils";
import { useTranslations } from "next-intl";

interface OffRampFormProps {
  hook: UseOffRampReturn;
  methods: OffRampPaymentMethod[];
  assets?: string[];
  balances: Record<string, number>;
  "data-testid"?: string;
}

/**
 * Off-ramp withdrawal form — Issue #21.
 * Pure presentational layer; all business logic lives in useOffRamp.
 */
export function OffRampForm({
  hook,
  methods,
  assets = ["XLM", "USDC", "USDT"],
  balances,
  "data-testid": testId = "off-ramp-form",
}: OffRampFormProps) {
  const t = useTranslations()
  const {
    amount,
    asset,
    paymentMethodId,
    isLoading,
    breakdown,
    validation,
    setAmount,
    setAsset,
    setPaymentMethod,
    setMaxAmount,
    submit,
  } = hook;

  const selectedMethod = methods.find((m) => m.id === paymentMethodId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit();
  };

  return (
    <form onSubmit={handleSubmit} data-testid={testId} aria-label="Withdrawal form" noValidate>
      {/* Amount & Asset */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="withdraw-amount">{t('common.amountToWithdraw')}</Label>
          <span className="text-xs text-muted-foreground">
            {t('common.balance')}: {(balances[asset] ?? 0).toFixed(2)} {asset}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            id="withdraw-amount"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            step="any"
            aria-label={t('common.amountToWithdraw')}
            aria-describedby={!validation.valid && validation.errorCode === "INVALID_AMOUNT" ? "amount-error" : undefined}
            className="flex-1"
          />
          <Select value={asset} onValueChange={setAsset}>
            <SelectTrigger className="w-24" aria-label="Select asset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assets.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {amount && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-6 p-1"
              onClick={setMaxAmount}
              aria-label="Use maximum available balance"
            >
              {t('common.useMax')}
            </Button>
          </div>
        )}

        {!validation.valid && validation.errorCode === "INVALID_AMOUNT" && (
          <p id="amount-error" role="alert" className="text-xs text-destructive">
            {validation.errorMessage}
          </p>
        )}
      </div>

      {/* Payment Methods */}
      <div className="space-y-3 mb-4">
        <Label>{t('common.paymentMethod')}</Label>
        <div role="radiogroup" aria-label="Payment methods">
          {methods.map((method) => (
            <div
              key={method.id}
              role="radio"
              aria-checked={paymentMethodId === method.id}
              aria-disabled={!method.enabled}
              tabIndex={method.enabled ? 0 : -1}
              className={`p-4 border rounded-lg mb-2 transition-all ${
                paymentMethodId === method.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              } ${!method.enabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => method.enabled && setPaymentMethod(method.id)}
              onKeyDown={(e) => {
                if (method.enabled && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setPaymentMethod(method.id);
                }
              }}
              data-testid={`payment-method-${method.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {method.type === "bank" ? (
                    <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{method.name}</span>
                    {!method.enabled && (
                      <Badge variant="secondary" className="text-xs">{t('common.comingSoon')}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{method.details}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {t('common.fee')}:{" "}
                      <FeeDisplay
                        feeStr={method.fees}
                        usdValue={breakdown?.usdValue ?? 0}
                      />
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {method.processingTime}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('common.limits')}: ${method.limits.min} – ${method.limits.max.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!validation.valid && validation.errorCode === "NO_PAYMENT_METHOD" && (
          <p role="alert" className="text-xs text-destructive">{validation.errorMessage}</p>
        )}
      </div>

      {/* Payout Summary */}
      {breakdown && selectedMethod && (
        <div className="mb-4">
          <PayoutSummary breakdown={breakdown} method={selectedMethod} />
        </div>
      )}

      {/* Validation errors (other than amount/method) */}
      {!validation.valid &&
        validation.errorCode !== "INVALID_AMOUNT" &&
        validation.errorCode !== "NO_PAYMENT_METHOD" && (
          <p role="alert" className="text-xs text-destructive mb-3">
            {validation.errorMessage}
          </p>
        )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={!validation.valid || isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? t('common.processing') : t('common.withdrawToBank')}
      </Button>
    </form>
  );
}
