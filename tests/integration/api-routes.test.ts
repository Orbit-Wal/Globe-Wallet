/** @jest-environment node */
import { NextRequest } from "next/server";
import {
  GET as assetsGET,
  POST as assetsPOST,
} from "../../app/api/assets/route";
import {
  GET as walletsGET,
  POST as walletsPOST,
} from "../../app/api/wallets/route";
import {
  GET as stellarGET,
  POST as stellarPOST,
} from "../../app/api/stellar/route";
import { POST as offRampPOST } from "../../app/api/off-ramp/route";

// Mock the finance services
jest.mock("../../lib/services/container", () => ({
  financeServices: {
    asset: {
      getAssets: jest
        .fn()
        .mockReturnValue([
          { code: "XLM", name: "Stellar Lumens", balance: 1000, priceUsd: 0.1 },
        ]),
      getAssetPrice: jest.fn().mockResolvedValue(0.1),
    },
    pricing: {
      getAssets: jest.fn().mockReturnValue([
        { code: 'XLM', name: 'Stellar Lumens', balance: 1000, priceUsd: 0.10 }
      ]),
      getPrice: jest.fn().mockImplementation((code: string) => {
        if (code === 'INVALID') {
          return Promise.reject(new Error('Asset INVALID not found'))
        }
        return Promise.resolve(0.10)
      }),
      formatAsset: jest.fn(),
    },
    fiat: {
      getWallets: jest
        .fn()
        .mockReturnValue([
          { code: "USD", label: "US Dollar", symbol: "$", balance: 1000 },
        ]),
      convertCurrency: jest.fn().mockReturnValue(1580.5),
      getExchangeRate: jest.fn().mockReturnValue(1580.5),
    },
    pricing: {
      getAssets: jest
        .fn()
        .mockReturnValue([
          { code: "XLM", name: "Stellar Lumens", balance: 1000, priceUsd: 0.1 },
        ]),
      getPrice: jest.fn().mockImplementation((assetCode: string) => {
        if (assetCode === "INVALID") {
          throw new Error("Invalid asset code");
        }
        return Promise.resolve(0.1);
      }),
    },
    wallet: {
      getAccountInfo: jest.fn().mockReturnValue({
        publicKey: "GDXS...BNRX",
        memo: "STLP-2048",
        network: "Stellar Public Network",
        id: "acct-primary",
        name: "Primary Wallet",
        isFunded: true,
      }),
      listAccounts: jest.fn().mockReturnValue([
        {
          id: "acct-primary",
          userId: "user-1",
          publicKey: "GDXS...BNRX",
          name: "Primary Wallet",
          accountType: "standard",
          isPrimary: true,
          isActive: true,
          network: "Stellar Public Network",
          isFunded: true,
          createdAt: new Date().toISOString(),
        },
      ]),
      getActiveAccountId: jest.fn().mockReturnValue("acct-primary"),
      switchAccount: jest.fn().mockReturnValue({
        id: "acct-primary",
        userId: "user-1",
        publicKey: "GDXS...BNRX",
        name: "Primary Wallet",
        accountType: "standard",
        isPrimary: true,
        isActive: true,
        network: "Stellar Public Network",
        isFunded: true,
        createdAt: new Date().toISOString(),
      }),
      validateAddress: jest.fn().mockReturnValue(true),
      generateReceiveAddress: jest.fn().mockReturnValue("GDXS...BNRX"),
    },
    stellar: {
      getAccountInfo: jest.fn().mockReturnValue({
        publicKey: "GDXS...BNRX",
        memo: "STLP-2048",
        network: "Stellar Public Network",
        id: "acct-primary",
        name: "Primary Wallet",
        isFunded: true,
      }),
      listAccounts: jest.fn().mockReturnValue([]),
      getActiveAccountId: jest.fn().mockReturnValue("acct-primary"),
      switchAccount: jest.fn(),
      getOffRampMethods: jest.fn().mockReturnValue([]),
      getOffRampRate: jest.fn().mockReturnValue(1580.5),
    },
    offRamp: {
      getMethods: jest.fn().mockReturnValue([
        {
          id: "m1",
          name: "Bank Transfer",
          description: "Wire transfer",
          currency: "USD",
          minAmount: 10,
          maxAmount: 10000,
          processingTime: "1-3 business days",
          fee: 2,
        },
      ]),
      getRates: jest
        .fn()
        .mockResolvedValue({ USD: 1.0, NGN: 1500.0, EUR: 0.92 }),
      initiateWithdrawal: jest.fn().mockResolvedValue({
        success: true,
        hash: "offramp_hash",
        status: "pending",
      }),
    },
  },
}));

describe("API Routes Integration", () => {
  describe("/api/assets", () => {
    it("GET should return assets list", async () => {
      const response = await assetsGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data[0]).toHaveProperty("code");
    });

    it("POST should return asset price", async () => {
      const request = new NextRequest("http://localhost/api/assets", {
        method: "POST",
        body: JSON.stringify({ assetCode: "XLM" }),
      });

      const response = await assetsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("assetCode", "XLM");
      expect(data.data).toHaveProperty("price", 0.1);
    });

    it("POST should handle invalid asset code", async () => {
      const request = new NextRequest("http://localhost/api/assets", {
        method: "POST",
        body: JSON.stringify({ assetCode: "INVALID" }),
      });

      const response = await assetsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("/api/wallets", () => {
    it("GET should return wallets list", async () => {
      const response = await walletsGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("POST should return currency conversion", async () => {
      const request = new NextRequest("http://localhost/api/wallets", {
        method: "POST",
        body: JSON.stringify({ from: "USD", to: "NGN", amount: 100 }),
      });

      const response = await walletsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("convertedAmount");
      expect(data.data).toHaveProperty("rate");
    });
  });

  describe("/api/stellar", () => {
    it("GET should return account info and off-ramp methods", async () => {
      const response = await stellarGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("account");
      expect(data.data).toHaveProperty("offRampMethods");
    });

    it("POST should validate address", async () => {
      const request = new NextRequest("http://localhost/api/stellar", {
        method: "POST",
        body: JSON.stringify({
          action: "validateAddress",
          data: {
            address: "GDXSPAYWALLET7QK3MUKXHV2RZ4D6FJ5N2YHV3K2L9P8QW1ZC4T6BNRX",
          },
        }),
      });

      const response = await stellarPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("isValid", true);
    });

    it("POST should handle invalid action", async () => {
      const request = new NextRequest("http://localhost/api/stellar", {
        method: "POST",
        body: JSON.stringify({
          action: "invalidAction",
          data: {},
        }),
      });

      const response = await stellarPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("/api/off-ramp", () => {
    it("POST should process withdrawal and return success details", async () => {
      const request = new NextRequest("http://localhost/api/off-ramp", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: JSON.stringify({
          asset: "XLM",
          amount: 10,
          paymentMethodId: "m1",
          fiatAmount: 15.0,
        }),
      });

      const response = await offRampPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        methodId: "m1",
        asset: "XLM",
        amount: 10,
        fiatAmount: 15.0,
        status: "pending",
      });
    });

    it("POST should return validation errors for missing fields", async () => {
      const request = new NextRequest("http://localhost/api/off-ramp", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: JSON.stringify({ asset: "XLM", amount: 10 }),
      });

      const response = await offRampPOST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
    });
  });
});
