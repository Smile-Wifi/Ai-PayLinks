import { NextRequest, NextResponse } from "next/server";
import { runOcr } from "@/lib/ocr";
import type { AiProvider } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      provider = "openai",
      model,
      baseUrl,
      imageBase64,
      imageUrl,
      // Optional: allow client to pass key for testing.
      // In production prefer server env vars.
      apiKey: clientKey,
    } = body;

    // Prefer server-side keys
    const envKey =
      provider === "anthropic"
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY || process.env.MUSE_API_KEY;

    const apiKey = clientKey || envKey;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No API key configured. Set OPENAI_API_KEY / ANTHROPIC_API_KEY in Vercel env, or pass apiKey temporarily.",
        },
        { status: 400 }
      );
    }

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: "Provide imageBase64 or imageUrl" },
        { status: 400 }
      );
    }

    const result = await runOcr({
      provider: provider as AiProvider,
      apiKey,
      model:
        model ||
        (provider === "anthropic"
          ? "claude-sonnet-4-20250514"
          : "gpt-4o"),
      baseUrl,
      imageBase64,
      imageUrl,
    });

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("[ocr]", err);
    return NextResponse.json(
      { error: err?.message || "OCR failed" },
      { status: 500 }
    );
  }
}
