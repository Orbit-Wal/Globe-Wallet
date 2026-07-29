"use client";

import {
  useContext,
  createContext,
  ReactNode,
  createElement,
  useState,
  useCallback,
} from "react";
import {
  IFinanceServiceContainer,
  AssetCode,
  CurrencyCode,
} from "../lib/types";
import { financeServices } from "../lib/services/container";

const FinanceServicesContext =
  createContext<IFinanceServiceContainer>(financeServices);

interface FinanceServicesProviderProps {
  children: ReactNode;
  services?: IFinanceServiceContainer;
}

export function FinanceServicesProvider({
  children,
  services = financeServices,
}: FinanceServicesProviderProps) {
  return createElement(
    FinanceServicesContext.Provider,
    { value: services },
    children,
  );
}

export function useFinanceServices(): IFinanceServiceContainer {
  return useContext(FinanceServicesContext);
}

// ── usePricing ────────────────────────────────────────────────────────────────

export function usePricing() {
  const { pricing } = useFinanceServices();
  return {
    getAssets: () => pricing.getAssets(),
    getPrice: (code: AssetCode) => pricing.getPrice(code),
    formatAsset: (amount: number, code: AssetCode, hidden?: boolean) =>
      pricing.formatAsset(amount, code, hidden),
  };
}

export function useAssets() {
  const { asset } = useFinanceServices();
  return {
    getAssets: () => asset.getAssets(),
    getPrice: (code: AssetCode) => asset.getAssetPrice(code),
    convert: (from: AssetCode, to: AssetCode, amount: number) =>
      asset.convertAsset(from, to, amount),
    format: (amount: number, code: AssetCode, hidden?: boolean) =>
      asset.formatAsset(amount, code, hidden),
  };
}

// ── useWallet ─────────────────────────────────────────────────────────────────
// isProcessing is tracked here in the hook layer, not in the service,
// keeping the service stateless and easily testable.

export function useWallet() {
  const { wallet } = useFinanceServices();
  const [isProcessing, setIsProcessing] = useState(false);

  const sendPayment = useCallback(
    async (dest: string, amt: number, asset: AssetCode, memo?: string) => {
      setIsProcessing(true);
      try {
        const result = await wallet.sendPayment(dest, amt, asset, memo);
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [wallet],
  );

  return {
    getAccount: (accountId?: string) => wallet.getAccountInfo(accountId),
    listAccounts: (userId?: string) => wallet.listAccounts(userId),
    getActiveAccountId: () => wallet.getActiveAccountId(),
    switchAccount: (accountId: string) => wallet.switchAccount(accountId),
    getBalance: (accountId?: string) => wallet.getBalance(accountId),
    sendPayment,
    generateAddress: (accountId?: string) => wallet.generateReceiveAddress(accountId),
    validateAddress: (address: string) => wallet.validateAddress(address),
    shortenKey: (key: string, lead?: number, tail?: number) =>
      wallet.shortenKey(key, lead, tail),
    getHistory: (accountId?: string) => wallet.getTransactionHistory(accountId),
    isProcessing,
  };
}

// ── useWallets (fiat) ─────────────────────────────────────────────────────────

export function useWallets() {
  const { fiat } = useFinanceServices();
  return {
    getWallets: () => fiat.getWallets(),
    formatMoney: (amount: number, currency: CurrencyCode, hidden?: boolean) =>
      fiat.formatMoney(amount, currency, hidden),
    convertCurrency: (from: CurrencyCode, to: CurrencyCode, amount: number) =>
      fiat.convertCurrency(from, to, amount),
    getAccountBalance: () => fiat.getAccountBalance(),
  };
}

// ── useOffRamp ────────────────────────────────────────────────────────────────

export function useOffRamp() {
  const { offRamp } = useFinanceServices();
  return {
    initiate: (amt: number, asset: AssetCode, mid: string, cur: CurrencyCode) =>
      offRamp.initiateWithdrawal(amt, asset, mid, cur),
    getRates: () => offRamp.getRates(),
    getMethods: () => offRamp.getMethods(),
  };
}

// ── useSoroban ────────────────────────────────────────────────────────────────

export function useSoroban() {
  const { soroban } = useFinanceServices();
  return {
    addAsset: (user: string, asset: { code: string; issuer?: string }) =>
      soroban.addAsset(user, asset),
    removeAsset: (user: string, asset: { code: string; issuer?: string }) =>
      soroban.removeAsset(user, asset),
    getAssets: (user: string) => soroban.getAssets(user),
    setSpendLimit: (user: string, asset: { code: string; issuer?: string }, limit: bigint) =>
      soroban.setSpendLimit(user, asset, limit),
    getSpendLimit: (user: string, asset: { code: string; issuer?: string }) =>
      soroban.getSpendLimit(user, asset),
    recordSpend: (user: string, asset: { code: string; issuer?: string }, amount: bigint) =>
      soroban.recordSpend(user, asset, amount),
  };
}
