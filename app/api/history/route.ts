import { NextRequest, NextResponse } from "next/server";
import type { HistoryEntry } from "@/lib/types";

/**
 * Lightweight history store.
 * For production on Vercel, replace this with Upstash Redis / Vercel KV / Neon.
 * This in-memory version works for single-instance / short sessions and demos.
 */

const globalStore = globalThis as unknown as {
  __paylinks_history?: HistoryEntry[];
};

if (!globalStore.__paylinks_history) {
  globalStore.__paylinks_history = [];
}

const store = () => globalStore.__paylinks_history!;

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  let records = [...store()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  if (orderId) {
    records = records.filter((r) => r.orderId === orderId);
  }

  return NextResponse.json({ data: { records } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry: HistoryEntry = {
      id: body.id || `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      created_at: body.created_at || new Date().toISOString(),
      orderId: body.orderId,
      action: body.action,
      note: body.note || "",
      aiResult: body.aiResult || "",
      amountChecked: body.amountChecked || "",
      refNo: body.refNo,
      decisionTime: body.decisionTime || new Date().toISOString(),
      approvedLink: body.approvedLink,
      checks: body.checks,
      source: body.source || "manual",
    };

    if (!entry.orderId || !entry.action) {
      return NextResponse.json(
        { error: "orderId and action are required" },
        { status: 400 }
      );
    }

    store().unshift(entry);

    // Keep last 500 entries to avoid unbounded growth
    if (store().length > 500) {
      store().length = 500;
    }

    return NextResponse.json({ data: entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save" },
      { status: 500 }
    );
  }
}
