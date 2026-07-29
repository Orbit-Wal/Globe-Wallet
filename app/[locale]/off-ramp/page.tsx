"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CreditCard,
  Building2,
  Clock,
  Shield,
  Info,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { computeFeeAmount } from "@/lib/off-ramp-utils";

interface PaymentMethod {
  id: string;
  type: "bank" | "card";
  name: string;
  details: string;
  fees: string;
  processingTime: string;
  limits: { min: number; max: number };
  enabled: boolean;
}

interface LastWithdrawal {
  methodId: string;
  methodName: string;
  asset: string;
  amount: number;
  fiatAmount: number;
  status: "completed" | "pending" | "failed";
  hash?: string;
  date: string;
}

const OFF_RAMP_SELECTED_METHOD_KEY = "globe-offramp-selected-method";
const OFF_RAMP_LAST_WITHDRAWAL_KEY = "globe-offramp-last-withdrawal";

export default function OffRampPage() {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XLM");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastWithdrawal, setLastWithdrawal] = useState<LastWithdrawal | null>(
    null,
  );
  const [backendError, setBackendError] = useState<string | null>(null);

  // Mock balances
  const balances = {
    XLM: 1250.45,
    USDC: 89.32,
    USDT: 156.78,
  };

  // Mock exchange rates to USD
  const rates = {
    XLM: 0.095,
    USDC: 1.0,
    USDT: 0.998,
  };

  // Mock payment methods
  const paymentMethods: PaymentMethod[] = [
    {
      id: "bank_1",
      type: "bank",
      name: "Chase Checking ****1234",
      details: "ACH Transfer",
      fees: "1.5%",
      processingTime: "1-3 business days",
      limits: { min: 10, max: 10000 },
      enabled: true,
    },
    {
      id: "bank_2",
      type: "bank",
      name: "Wells Fargo Savings ****5678",
      details: "Wire Transfer",
      fees: "$15 + 1%",
      processingTime: "Same day",
      limits: { min: 100, max: 50000 },
      enabled: true,
    },
    {
      id: "card_1",
      type: "card",
      name: "Visa Debit ****9012",
      details: "Instant Transfer",
      fees: "2.5%",
      processingTime: "Instant",
      limits: { min: 5, max: 1000 },
      enabled: false,
    },
  ];

  const getUSDValue = () => {
    if (!amount) return 0;
    return parseFloat(amount) * rates[currency as keyof typeof rates];
  };

  const getFeeAmount = () => {
    const method = paymentMethods.find((m) => m.id === paymentMethod);
    if (!method || !amount) return 0;

    const usdAmount = getUSDValue();
    return computeFeeAmount(usdAmount, method.fees).feeAmount;
  };

  const getNetAmount = () => {
    return getUSDValue() - getFeeAmount();
  };

  useEffect(() => {
    const storedMethod = window.localStorage.getItem(
      OFF_RAMP_SELECTED_METHOD_KEY,
    );
    const storedWithdrawal = window.localStorage.getItem(
      OFF_RAMP_LAST_WITHDRAWAL_KEY,
    );

    if (storedMethod) {
      setPaymentMethod(storedMethod);
    }

    if (storedWithdrawal) {
      try {
        setLastWithdrawal(JSON.parse(storedWithdrawal));
      } catch {
        window.localStorage.removeItem(OFF_RAMP_LAST_WITHDRAWAL_KEY);
      }
    }
  }, []);

  const persistSelectedMethod = (methodId: string) => {
    setPaymentMethod(methodId);
    window.localStorage.setItem(OFF_RAMP_SELECTED_METHOD_KEY, methodId);
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    const balance = balances[currency as keyof typeof balances];
    if (parseFloat(amount) > balance) {
      toast.error(`Insufficient ${currency} balance`);
      return;
    }

    const method = paymentMethods.find((m) => m.id === paymentMethod);
    const usdAmount = getUSDValue();

    if (
      method &&
      (usdAmount < method.limits.min || usdAmount > method.limits.max)
    ) {
      toast.error(
        `Amount must be between $${method.limits.min} - $${method.limits.max}`,
      );
      return;
    }

    setBackendError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/off-ramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: currency,
          amount: parseFloat(amount),
          paymentMethodId: paymentMethod,
          fiatAmount: usdAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data?.error || "Unable to process withdrawal";
        setBackendError(message);
        toast.error(message);
        return;
      }

      const result = data.data;
      const savedWithdrawal = {
        methodId: result.methodId,
        methodName: result.methodName,
        asset: result.asset,
        amount: result.amount,
        fiatAmount: result.fiatAmount,
        status: result.status ?? "pending",
        hash: result.hash,
        date: new Date().toISOString(),
      };

      window.localStorage.setItem(
        OFF_RAMP_LAST_WITHDRAWAL_KEY,
        JSON.stringify(savedWithdrawal),
      );
      setLastWithdrawal(savedWithdrawal);

      toast.success(
        `Withdrawal initiated. You'll receive $${getNetAmount().toFixed(2)} via ${method?.name}`,
      );
      setAmount("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to process withdrawal";
      setBackendError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-4 p-4 pb-2">
        <Link
          href="/"
          aria-label="Go back to home"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-semibold">Cash Out</h1>
      </div>

      <div className="px-4 pb-4">
        <Tabs defaultValue="withdraw" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="space-y-4">
            {/* Amount Selection */}
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Amount to withdraw</Label>
                    <span className="text-xs text-muted-foreground">
                      Balance:{" "}
                      {balances[currency as keyof typeof balances]?.toFixed(2)}{" "}
                      {currency}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-24" aria-label="Withdrawal currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XLM">XLM</SelectItem>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {amount && (
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 p-1"
                        onClick={() =>
                          setAmount(
                            balances[
                              currency as keyof typeof balances
                            ].toString(),
                          )
                        }
                      >
                        Use max
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        ≈ ${getUSDValue().toFixed(2)} USD
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Payment Methods */}
            <Card className="p-6">
              <div className="space-y-4">
                <Label>Payment method</Label>
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all block ${
                        paymentMethod === method.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      } ${!method.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={() =>
                          method.enabled && persistSelectedMethod(method.id)
                        }
                        disabled={!method.enabled}
                        className="sr-only"
                        aria-label={`Select ${method.name} - ${method.details}`}
                      />
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {method.type === "bank" ? (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{method.name}</span>
                            {!method.enabled && (
                              <Badge variant="secondary" className="text-xs">
                                Coming Soon
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {method.details}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Fee: {method.fees}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {method.processingTime}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Limits: ${method.limits.min} - $
                            {method.limits.max.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            {/* Transaction Summary */}
            {amount && paymentMethod && (
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-4 w-4" />
                    Transaction Summary
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Withdraw Amount
                      </span>
                      <span>
                        {amount} {currency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">USD Value</span>
                      <span>${getUSDValue().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Processing Fee
                      </span>
                      <span>-${getFeeAmount().toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 mt-2 flex justify-between font-medium">
                      <span>You'll receive</span>
                      <span>${getNetAmount().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Withdraw Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleWithdraw}
              disabled={
                !amount ||
                !paymentMethod ||
                isLoading ||
                parseFloat(amount) <= 0
              }
            >
              {isLoading ? "Processing..." : "Withdraw to Bank"}
            </Button>

            {backendError && (
              <Card className="p-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">Withdrawal failed</p>
                    <p>{backendError}</p>
                  </div>
                </div>
              </Card>
            )}

            {lastWithdrawal && (
              <Card className="p-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Last withdrawal</span>
                    <Badge variant="secondary" className="text-xs">
                      {lastWithdrawal.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {lastWithdrawal.amount} {lastWithdrawal.asset} (~$
                    {lastWithdrawal.fiatAmount.toFixed(2)}) to{" "}
                    {lastWithdrawal.methodName}.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastWithdrawal.date).toLocaleString()}
                  </p>
                </div>
              </Card>
            )}

            {/* Security Notice */}
            <Card className="p-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Secure & Regulated
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    All withdrawals are processed through regulated financial
                    partners with bank-level security. Transactions may be
                    subject to compliance checks.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="methods" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Your Payment Methods</h3>
                <Button variant="outline" size="sm">
                  Add Method
                </Button>
              </div>

              {paymentMethods.map((method) => (
                <Card key={method.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {method.type === "bank" ? (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{method.name}</span>
                        <div className="flex items-center gap-2">
                          {method.enabled ? (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-800"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Coming Soon</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {method.details}
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Fee:</span>
                          <span className="ml-1 font-medium">
                            {method.fees}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Processing:
                          </span>
                          <span className="ml-1 font-medium">
                            {method.processingTime}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Limits:</span>
                          <span className="ml-1 font-medium">
                            ${method.limits.min} - $
                            {method.limits.max.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              <Card className="p-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Adding Payment Methods
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Connect your bank account or debit card for seamless
                      withdrawals. All payment methods are verified and
                      encrypted for your security.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
