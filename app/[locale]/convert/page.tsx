"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  ArrowLeft,
  ArrowUpDown,
  TrendingUp,
  Info,
  AlertCircle,
  Settings2,
  Route,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ratesService, type ExchangeRate } from "@/lib/services/rates.service";
import type { AssetCode } from "@/lib/types";
import {
  deriveToAmount,
  deriveFromAmount,
  calculateNetReceived,
  formatConversionRate,
} from "@/lib/helpers/conversion-math";

export default function ConvertPage() {
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState<AssetCode>("XLM");
  const [toCurrency, setToCurrency] = useState<AssetCode>("USDC");
  const [isConverting, setIsConverting] = useState(false);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  
  // Missing state variables for JSX
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(1);
  const [quote, setQuote] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isNoPathError, setIsNoPathError] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);

  const balances: Record<string, number> = {
    XLM: 1250.45,
    USDC: 89.32,
    USDT: 156.78,
    NGN: 50000,
    USD: 500,
    EUR: 450,
  };

  // Debounce Ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch summary exchange rate for header card
  useEffect(() => {
    const fetchRates = async () => {
      setIsLoadingRates(true);
      setRatesError(null);
      try {
        const fetchedRates = await ratesService.getExchangeRates(fromCurrency, [
          fromCurrency,
          toCurrency,
        ]);
        setRates(fetchedRates);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load exchange rates";
        setRatesError(message);
        toast.error("Could not load exchange rates, using cached rates");
      } finally {
        setIsLoadingRates(false);
      }
    };

    fetchRates();
  }, [fromCurrency, toCurrency]);

  const getCurrentRate = () => {
    return rates.find((r) => r.from === fromCurrency && r.to === toCurrency);
  };

  const calculateConversion = (amount: string, isFromAmount: boolean) => {
    const rate = getCurrentRate()?.rate;
    if (!rate || !amount) return "";

    if (isFromAmount) {
      return deriveToAmount(amount, rate);
    } else {
      return deriveFromAmount(amount, rate);
    }
  };

  // Countdown timer for quote expiration
  useEffect(() => {
    if (fromAmount) {
      setToAmount(calculateConversion(fromAmount, true));
    } else {
      setToAmount("");
    }
  }, [fromAmount, fromCurrency, toCurrency]);

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    setToAmount(calculateConversion(value, true));
  };

  const handleToAmountChange = (value: string) => {
    setToAmount(value);
    setFromAmount(calculateConversion(value, false));
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromAmount(toAmount);
  };

  const handleConvert = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const balance = balances[fromCurrency];
    if (parseFloat(fromAmount) > balance) {
      toast.error(`Insufficient ${fromCurrency} balance`);
      return;
    }

    setIsConverting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success(
        `Successfully converted ${fromAmount} ${fromCurrency} to ${toAmount} ${toCurrency}`,
      );
      setFromAmount("");
      setToAmount("");
    } catch (error) {
      toast.error("Conversion failed. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  const currentRate = getCurrentRate();

  return (
    <AppShell>
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Go back to home"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <h1 className="text-lg font-semibold">Convert</h1>
        </div>

        {/* Slippage Settings Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSlippageSettings(!showSlippageSettings)}
          className="flex items-center gap-1.5 text-xs"
          aria-label="Slippage Settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span>{slippageTolerance}% slippage</span>
        </Button>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* Loading state */}
        {isLoadingRates && (
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">
              Loading exchange rates...
            </div>
          </Card>
        )}

        {/* Error State — No Path Found */}
        {isNoPathError && !isLoadingQuote && (
          <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">No conversion path available</span>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  There is currently no orderbook liquidity or AMM pool connecting {fromCurrency} to {toCurrency}.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Error State — Network Failure */}
        {isNetworkError && !isLoadingQuote && (
          <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20">
            <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">Horizon Network Error</span>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  Unable to reach Stellar network server. Check internet connection and retry.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Exchange Rate Summary Card */}
        {currentRate && !isLoadingQuote && !isNoPathError && !isNetworkError && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    1 {fromCurrency} = {currentRate.rate.toFixed(6)}{" "}
                    {toCurrency}
                  </span>
                  <TrendingUp
                    className={`h-4 w-4 ${
                      currentRate.change24h >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  />
                </div>
                {currentRate.change24h > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="text-green-500">
                      +{currentRate.change24h}%
                    </span>
                    <span>24h change</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Conversion Form */}
        <Card className="p-6">
          <div className="space-y-4">
            {/* From Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>From</Label>
                <span className="text-xs text-muted-foreground">
                  Balance: {balances[fromCurrency]?.toFixed(2)} {fromCurrency}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={fromAmount}
                    onChange={(e) => handleFromAmountChange(e.target.value)}
                  />
                </div>
                <Select
                  value={fromCurrency}
                  onValueChange={(val: string) =>
                    setFromCurrency(val as AssetCode)
                  }
                >
                  <SelectTrigger className="w-24" aria-label="From currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XLM">XLM</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {fromAmount && balances[fromCurrency] && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 p-1"
                  onClick={() =>
                    handleFromAmountChange(balances[fromCurrency].toString())
                  }
                >
                  Use max
                </Button>
              )}
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-full"
                onClick={swapCurrencies}
                aria-label="Swap currencies"
              >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* To Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>To</Label>
                <span className="text-xs text-muted-foreground">
                  Balance: {balances[toCurrency]?.toFixed(2)} {toCurrency}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={toAmount}
                    onChange={(e) => handleToAmountChange(e.target.value)}
                  />
                </div>
                <Select
                  value={toCurrency}
                  onValueChange={(val: string) =>
                    setToCurrency(val as AssetCode)
                  }
                >
                  <SelectTrigger className="w-24" aria-label="To currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XLM">XLM</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* Transaction Details */}
        {fromAmount && toAmount && (
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-primary" />
                  <span>Transaction Details</span>
                </div>
                {quote?.path && quote.path.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Route className="h-3.5 w-3.5" />
                    <span>Path: {quote.path.map((p) => p.code).join(" → ")}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exchange Rate</span>
                  <span>
                    1 {fromCurrency} = {currentRate?.rate.toFixed(6)}{" "}
                    {toCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span>0.00001 XLM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Fee</span>
                  <span>0.1%</span>
                </div>
                {quote && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                    <span>
                      {quote.mode === "strictSend" ? "Guaranteed Minimum Output" : "Maximum Input Limit"} ({quote.slippageTolerance}%)
                    </span>
                    <span>
                      {quote.mode === "strictSend" ? `${quote.destMin} ${toCurrency}` : `${quote.sendMax} ${fromCurrency}`}
                    </span>
                  </div>
                )}
                {quote?.priceImpact !== null && quote?.priceImpact !== undefined && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Price Impact</span>
                    <span className={quote.priceImpact > 2 ? "text-amber-600 font-medium" : ""}>
                      {quote.priceImpact > 0 ? `${quote.priceImpact}%` : "< 0.01%"}
                    </span>
                  </div>
                )}
                <div className="border-t pt-1 mt-2 flex justify-between font-medium">
                  <span>You'll receive</span>
                  <span>
                    {calculateNetReceived(toAmount).toFixed(6)} {toCurrency}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Convert Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleConvert}
          disabled={
            !fromAmount ||
            !toAmount ||
            isConverting ||
            isLoadingQuote ||
            isNoPathError ||
            parseFloat(fromAmount) <= 0
          }
        >
          {isConverting ? "Converting..." : "Convert"}
        </Button>

        {/* Info Card */}
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-blue-500" />
              How it works
            </div>
            <p className="text-xs text-muted-foreground">
              Conversions are executed through Stellar's decentralized exchange
              using automated market makers. Rates update in real-time based on
              market conditions. A small network fee is required for each
              transaction.
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
