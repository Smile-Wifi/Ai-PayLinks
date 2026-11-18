import { NextRequest, NextResponse } from "next/server";
import { buildChecks, allCriticalPass, getCriticalFailures } from "@/lib/matching";
import type { OcrResult, Order } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Server-side verification endpoint.
 * Accepts OCR result + order details and returns the structured checks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ocr, order, typedRef = "" } = body as {
      ocr: OcrResult;
      order: Order;
      typedRef?: string;
    };

    if (!ocr || !order) {
      return NextResponse.json(
        { error: "ocr and order are required" },
        { status: 400 }
      );
    }

    const checks = buildChecks(ocr, order, typedRef);
    const criticalOk = allCriticalPass(checks);
    const criticalFailures = getCriticalFailures(checks);

    return NextResponse.json({
      data: {
        checks,
        allCriticalPass: criticalOk,
        criticalFailures,
        canAutoApprove: criticalOk,
      },
    });
  } catch (err: any) {
    console.error("[verify]", err);
    return NextResponse.json(
      { error: err?.message || "Verification failed" },
      { status: 500 }
    );
  }
}
