@'
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileCheck2,
  History,
  ImagePlus,
  Loader2,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  AiSettingsPanel,
  loadAiSettings,
} from "@/components/AiSettingsPanel";
import {
  allCriticalPass,
  buildChecks,
  fmtPeso,
  getCriticalFailures,
} from "@/lib/matching";
import type {
  AiSettings,
  CheckItem,
  DecisionInfo,
  HistoryEntry,
  OcrResult,
  Order,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  order: Order;
};

export function VerificationDashboard({ order }: Props) {
  const [aiSettings, setAiSettings] = useState<AiSettings>(() =>
    loadAiSettings()
  );
  const [imagePreview, setImagePreview] = useState<string>("");
  const [typedRef, setTypedRef] = useState<string>(order.expectedRef || "");
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [decision, setDecision] = useState<DecisionInfo | null>(null);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAiSettings(loadAiSettings());
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/history?orderId=${encodeURIComponent(order.id)}`
      );
      if (res.ok) {
        const json = await res.json();
        setHistory(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      // Ignore history fetch failures on ephemeral instances
    } finally {
      setLoadingHistory(false);
    }
  }, [order.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Re-evaluate checks live whenever typedRef or ocrResult changes
  useEffect(() => {
    if (!ocrResult) return;
    setChecks(buildChecks(ocrResult, order, typedRef));
  }, [ocrResult, order, typedRef]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg("");
    setOcrResult(null);
    setChecks([]);
    setDecision(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const runScan = async () => {
    if (!imagePreview && !aiSettings.demoMode) {
      setErrorMsg("Please upload a GCash receipt screenshot first.");
      return;
    }

    setScanning(true);
    setErrorMsg("");
    setDecision(null);

    try {
      let extracted: OcrResult;

      if (aiSettings.demoMode) {
        await new Promise((r) => setTimeout(r, 600));
        extracted = {
          receiver_name: order.qrReceiver,
          receiver_number: order.qrMobile || "+63 975 276 5499",
          amount: order.amount,
          total_amount_sent: order.amount,
          ref_no:
            typedRef.replace(/\D/g, "").length >= 10
              ? typedRef.replace(/\D/g, "")
              : "9018472635192",
          date: new Date().toLocaleString("en-US"),
          payment_method: "GCash Express Send",
        };
      } else {
        const ocrRes = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: aiSettings.provider,
            model: aiSettings.model,
            baseUrl: aiSettings.baseUrl || undefined,
            apiKey: aiSettings.apiKey || undefined,
            imageBase64: imagePreview,
          }),
        });

        const ocrJson = await ocrRes.json();
        if (!ocrRes.ok) {
          throw new Error(ocrJson.error || "OCR scan failed");
        }
        extracted = ocrJson.data as OcrResult;
      }

      setOcrResult(extracted);

      // Run server verification check for parity
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocr: extracted,
          order,
          typedRef,
        }),
      });

      if (verifyRes.ok) {
        const verifyJson = await verifyRes.json();
        if (verifyJson?.data?.checks) {
          setChecks(verifyJson.data.checks);
          return;
        }
      }

      setChecks(buildChecks(extracted, order, typedRef));
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to scan receipt");
    } finally {
      setScanning(false);
    }
  };

  const recordDecision = async (
    action: "Verified" | "Rejected",
    source: "manual" | "auto" = "manual"
  ) => {
    setSubmittingDecision(true);
    const refNo = ocrResult?.ref_no || typedRef || "N/A";
    const timeISO = new Date().toISOString();
    const link = `/verify/${encodeURIComponent(order.id)}`;

    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: timeISO,
      orderId: order.id,
      action,
      note:
        note.trim() ||
        (source === "auto"
          ? "Auto-confirmed: all critical checks passed"
          : `${action} by operator`),
      aiResult: ocrResult
        ? `${ocrResult.receiver_name} • ${fmtPeso(ocrResult.amount)}`
        : "Manual decision",
      amountChecked: ocrResult
        ? fmtPeso(ocrResult.amount)
        : fmtPeso(order.amount),
      refNo,
      decisionTime: timeISO,
      approvedLink: link,
      checks: checks.map((c) => ({
        label: c.label,
        pass: c.pass,
        critical: c.critical,
      })),
      source,
    };

    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch {
      // Still update local state even if POST fails
    }

    setDecision({
      action,
      refNo,
      timeISO,
      link,
      note: entry.note,
    });
    setHistory((prev) => [entry, ...prev]);
    setSubmittingDecision(false);
  };

  const criticalOk = checks.length > 0 && allCriticalPass(checks);
  const criticalFailures = checks.length > 0 ? getCriticalFailures(checks) : [];

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292d36] pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#292d36] bg-[#1a1d22] text-[#a9b0bc] transition hover:border-[#007DFE]/50 hover:text-white"
              aria-label="Back to orders"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#007DFE]">
                  AI PayLinks
                </span>
                <span className="rounded-md bg-[#1a1d22] px-2 py-0.5 font-mono text-xs text-[#a9b0bc]">
                  {order.id}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
                {order.event}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#292d36] bg-[#1a1d22] px-4 py-2.5">
            <span className="text-xs text-[#a9b0bc]">Expected Amount</span>
            <span className="text-lg font-extrabold text-[#007DFE]">
              {fmtPeso(order.amount)}
            </span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* Left Column: Order Details + Receipt Upload + Settings */}
          <div className="space-y-6 lg:col-span-5">
            {/* Order Card */}
            <div className="rounded-2xl border border-[#292d36] bg-[#1a1d22] p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#767e8b]">
                Order & Expected Receiver
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#a9b0bc]">Customer</dt>
                  <dd className="font-semibold">
                    {order.customer}
                    {order.customerMobile ? ` (${order.customerMobile})` : ""}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#a9b0bc]">QR Receiver</dt>
                  <dd className="font-mono font-semibold text-white">
                    {order.qrReceiver}
                  </dd>
                </div>
                {order.qrMobile && (
                  <div className="flex justify-between">
                    <dt className="text-[#a9b0bc]">QR Mobile</dt>
                    <dd className="font-mono text-xs text-[#a9b0bc]">
                      {order.qrMobile}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-[#a9b0bc]">Created</dt>
                  <dd className="text-xs text-[#a9b0bc]">{order.datetime}</dd>
                </div>
              </dl>
            </div>

            {/* Receipt Upload & Scan */}
            <div className="rounded-2xl border border-[#292d36] bg-[#1a1d22] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#767e8b]">
                  GCash Receipt
                </h2>
                {aiSettings.demoMode && (
                  <span className="rounded-full bg-[#007DFE]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#007DFE]">
                    Demo Mode Active
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative overflow-hidden rounded-xl border border-[#343a46] bg-[#121212]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Uploaded GCash receipt"
                    className="max-h-72 w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2.5 right-2.5 rounded-lg bg-[#121212]/90 px-3 py-1.5 text-xs font-semibold text-white border border-[#343a46] hover:bg-[#1e2229]"
                  >
                    Replace image
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#343a46] bg-[#121212] px-4 py-8 text-center transition hover:border-[#007DFE]/60 hover:bg-[#161920]"
                >
                  <ImagePlus size={24} className="text-[#007DFE]" />
                  <p className="text-sm font-semibold">
                    Upload GCash Screenshot
                  </p>
                  <p className="text-xs text-[#767e8b]">
                    PNG, JPG, or WEBP receipt image
                  </p>
                </button>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-[#a9b0bc]">
                  Customer-Typed Reference No.{" "}
                  <span className="text-[#767e8b]">(optional)</span>
                </span>
                <input
                  type="text"
                  value={typedRef}
                  onChange={(e) => setTypedRef(e.target.value)}
                  placeholder="e.g. 9018472635192"
                  className="mt-1.5 w-full rounded-xl border border-[#343a46] bg-[#121212] px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[#007DFE]"
                />
              </label>

              <button
                type="button"
                onClick={runScan}
                disabled={scanning}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007DFE] py-3 text-sm font-bold text-white transition hover:bg-[#006ae0] disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Scanning Receipt…
                  </>
                ) : (
                  <>
                    <ScanLine size={18} />
                    {aiSettings.demoMode
                      ? "Run Demo OCR Scan"
                      : "Scan Receipt with AI"}
                  </>
                )}
              </button>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* AI Provider Settings */}
            <div className="rounded-2xl border border-[#292d36] bg-[#1a1d22] p-4">
              <AiSettingsPanel value={aiSettings} onChange={setAiSettings} />
            </div>
          </div>

          {/* Right Column: OCR Output + Verification Checks + Actions + History */}
          <div className="space-y-6 lg:col-span-7">
            {/* OCR Extracted Summary */}
            <div className="rounded-2xl border border-[#292d36] bg-[#1a1d22] p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#767e8b]">
                  <FileCheck2 size={15} className="text-[#007DFE]" />
                  Extracted Receipt Fields
                </h2>
                {ocrResult && (
                  <span className="text-xs text-[#a9b0bc]">
                    {ocrResult.payment_method || "GCash"}
                  </span>
                )}
              </div>

              {ocrResult ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#121212] p-3">
                    <p className="text-[11px] text-[#767e8b]">Amount</p>
                    <p className="mt-1 text-base font-bold text-[#007DFE]">
                      {fmtPeso(ocrResult.amount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#121212] p-3">
                    <p className="text-[11px] text-[#767e8b]">Reference No.</p>
                    <p className="mt-1 font-mono text-sm font-bold">
                      {ocrResult.ref_no || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#121212] p-3">
                    <p className="text-[11px] text-[#767e8b]">Receiver</p>
                    <p className="mt-1 text-sm font-bold">
                      {ocrResult.receiver_name || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#121212] p-3">
                    <p className="text-[11px] text-[#767e8b]">Receiver Mobile</p>
                    <p className="mt-1 font-mono text-xs text-[#a9b0bc]">
                      {ocrResult.receiver_number || "—"}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-[#121212] p-3">
                    <p className="text-[11px] text-[#767e8b]">Receipt Timestamp</p>
                    <p className="mt-1 text-xs text-[#a9b0bc]">
                      {ocrResult.date || "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-[#121212] px-4 py-6 text-center text-sm text-[#767e8b]">
                  Scan a receipt to populate extracted GCash fields and run
                  automated checks.
                </p>
              )}
            </div>

            {/* Verification Checks */}
            <div className="rounded-2xl border border-[#292d36] bg-[#1a1d22] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#767e8b]">
                  {checks.length === 0 ? (
                    <Clock size={15} />
                  ) : criticalOk ? (
                    <ShieldCheck size={16} className="text-emerald-400" />
                  ) : (
                    <ShieldAlert size={16} className="text-red-400" />
                  )}
                  Verification Checks
                </h2>

                {checks.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      criticalOk
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-red-500/15 text-red-300"
                    )}
                  >
                    {criticalOk
                      ? "All Critical Checks Passed"
                      : `${criticalFailures.length} Critical Failure${
                          criticalFailures.length > 1 ? "s" : ""
                        }`}
                  </span>
                )}
              </div>

              {checks.length > 0 ? (
                <div className="space-y-2">
                  {checks.map((c) => (
                    <div
                      key={c.n}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm",
                        c.pass
                          ? "border-[#292d36] bg-[#121212]"
                          : c.critical
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-amber-500/30 bg-amber-500/5"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {c.pass ? (
                          <CheckCircle2
                            size={17}
                            className="mt-0.5 shrink-0 text-emerald-400"
                          />
                        ) : c.critical ? (
                          <XCircle
                            size={17}
                            className="mt-0.5 shrink-0 text-red-400"
                          />
                        ) : (
                          <AlertTriangle
                            size={17}
                            className="mt-0.5 shrink-0 text-amber-400"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{c.label}</span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                                c.critical
                                  ? "bg-[#007DFE]/15 text-[#007DFE]"
                                  : "bg-[#292d36] text-[#a9b0bc]"
                              )}
                            >
                              {c.critical ? "Critical" : "Soft"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[#a9b0bc]">
                            Expected:{" "}
                            <span className="text-white">{c.expected}</span> ·
                            Receipt:{" "}
                            <span className="text-white">{c.receipt}</span>
                          </p>
                          {!c.pass && c.reason && (
                            <p className="mt-1 text-xs text-red-300">
                              {c.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-[#121212] px-4 py-5 text-center text-sm text-[#767e8b]">
                  Waiting for receipt scan…
                </p>
              )}

              {/* Decision Controls */}
              <div className="border-t border-[#292d36] pt-4 space-y-3">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional operator note for audit log…"
                  className="w-full rounded-xl border border-[#343a46] bg-[#121212] px-3.5 py-2.5 text-sm outline-none focus:border-[#007DFE]"
                />

                <div className="flex flex-wrap gap-3">
                  {criticalOk && (
                    <button
                      type="button"
                      disabled={submittingDecision}
                      onClick={() => recordDecision("Verified", "auto")}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Sparkles size={16} />
                      Auto Confirm Payment
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={submittingDecision}
                    onClick={() => recordDecision("Verified", "manual")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#007DFE] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#006ae0] disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    Approve Manually
                  </button>

                  <button
                    type="button"
                    disabled={submittingDecision}
                    onClick={() => recordDecision("Rejected", "manual")}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>

                {decision && (
                  <div
                    className={cn(
                      "rounded-xl border p-3.5 text-xs",
                      decision.action === "Verified"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-red-500/30 bg-red-500/10 text-red-200"
                    )}
                  >
                    <p className="font-bold">
                      Order {order.id} marked as {decision.action}
                    </p>
                    <p className="mt-1 opacity-90">
                      Ref: <span className="font-mono">{decision.refNo}</span> ·{" "}
                      {new Date(decision.timeISO).toLocaleString("en-US")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Audit History */}
            <div className="rounded-2xl border border-[#292d36] bg-[#1a1d22] p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#767e8b]">
                  <History size={15} />
                  Decision History ({history.length})
                </h2>
                {loadingHistory && (
                  <Loader2 size={14} className="animate-spin text-[#767e8b]" />
                )}
              </div>

              {history.length === 0 ? (
                <p className="mt-3 text-xs text-[#767e8b]">
                  No decisions recorded for {order.id} yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-xl bg-[#121212] px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <span
                          className={cn(
                            "font-bold",
                            h.action === "Verified"
                              ? "text-emerald-400"
                              : "text-red-400"
                          )}
                        >
                          {h.action}
                        </span>{" "}
                        <span className="text-[#a9b0bc]">· {h.note}</span>
                        {h.refNo && (
                          <p className="mt-0.5 font-mono text-[11px] text-[#767e8b]">
                            Ref: {h.refNo} ({h.amountChecked})
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-[#767e8b]">
                        {new Date(h.created_at).toLocaleTimeString("en-US")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'@ | Set-Content -Path "components\VerificationDashboard.tsx" -Encoding UTF8