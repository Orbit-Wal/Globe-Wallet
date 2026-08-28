import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { financeServices } from "../../../lib/services/container";
import { db } from "../../../lib/db/mock-db";
import { OffRampRequest } from "../../../lib/types";
import { requireAuth, parseBody } from "@/lib/api/http";

const OffRampSchema = z.object({
  asset: z.string().min(1, "Asset is required"),
  paymentMethodId: z.string().min(1, "Payment method is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  fiatAmount: z.coerce.number().positive("Fiat amount is required"),
});

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const parsed = await parseBody(request, OffRampSchema);
  if (!parsed.ok) return parsed.response;

  const { asset, amount, paymentMethodId, fiatAmount } = parsed.data as OffRampRequest;

  const method = financeServices.offRamp
    .getMethods()
    .find((method) => method.id === paymentMethodId);
  if (!method) {
    return NextResponse.json(
      { success: false, error: "Payment method not found" },
      { status: 404 },
    );
  }

  if (fiatAmount < method.minAmount || fiatAmount > method.maxAmount) {
    return NextResponse.json(
      {
        success: false,
        error: `Withdrawal must be between ${method.minAmount} and ${method.maxAmount} ${method.currency}`,
      },
      { status: 422 },
    );
  }

  try {
    // Issue #69: the real SEP-24 interactive flow needs the withdrawing
    // Stellar account's public key.
    const account = await db.getActiveAccount();
    const result = await financeServices.offRamp.initiateWithdrawal(
      amount,
      asset,
      paymentMethodId,
      method.currency,
      account?.publicKey,
    );

    await db.saveTransaction({
      id: `withdraw_${Math.random().toString(36).slice(2, 10)}`,
      type: "withdraw",
      amount,
      asset,
      address: paymentMethodId,
      date: new Date().toISOString(),
      status: result.success ? (result.status ?? "pending") : "failed",
      stellarHash: result.hash,
      detail: `Withdrawal to ${method.name}`,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          methodId: paymentMethodId,
          methodName: method.name,
          asset,
          amount,
          fiatAmount,
          status: result.status,
          hash: result.hash,
          // Issue #69: SEP-24 hosted interactive-withdrawal URL — the
          // client must redirect the user here to complete the withdrawal.
          interactiveUrl: result.interactiveUrl,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to process off-ramp",
      },
      { status: 500 },
    );
  }
}
