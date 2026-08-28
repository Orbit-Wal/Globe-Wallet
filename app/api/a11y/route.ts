import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { a11yService } from "@/lib/services/a11y.service";
import type { A11yImpactLevel } from "@/lib/types";
import { requireAuth, parseBody } from "@/lib/api/http";

const AuditSchema = z.object({
  path: z.string().min(1, "Missing required field: path"),
  minImpact: z.enum(["minor", "moderate", "serious", "critical"]).optional(),
});

// Issue #68: intentionally PUBLIC — static standard/page config, no user data.
export async function GET() {
  return NextResponse.json(
    {
      standard: a11yService.getStandard(),
      pages: a11yService.getPages(),
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const parsed = await parseBody(request, AuditSchema);
  if (!parsed.ok) return parsed.response;

  const minImpact = parsed.data.minImpact as A11yImpactLevel | undefined;
  const result = a11yService.auditPage({ path: parsed.data.path, minImpact });

  if (!result.success) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result, { status: 200 });
}
