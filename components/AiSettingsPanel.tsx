"use client";

import { useEffect, useState } from "react";
import { ChevronDown, KeyRound, Loader2, Zap } from "lucide-react";
import type { AiProvider, AiSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS: Record<AiProvider, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  ],
  muse: [
    { value: "muse", label: "Muse (default)" },
    { value: "auto", label: "Auto" },
  ],
  custom: [{ value: "custom", label: "Custom model" }],
};

const STORAGE_KEY = "ai_paylinks_settings";

type Props = {
  value: AiSettings;
  onChange: (s: AiSettings) => void;
};

export function AiSettingsPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {}
  }, [value]);

  const update = (patch: Partial<AiSettings>) => {
    onChange({ ...value, ...patch });
  };

  const testConnection = async () => {
    if (value.demoMode) {
      setTestResult("Demo Mode is ON — turn it off to test a real key.");
      return;
    }
    if (!value.apiKey.trim()) {
      setTestResult("Please paste an API key first.");
      return;
    }

    setTesting(true);
    setTestResult("Testing…");

    try {
      const endpoint =
        value.baseUrl.trim() ||
        (value.provider === "openai"
          ? "https://api.openai.com/v1/models"
          : value.provider === "anthropic"
          ? "https://api.anthropic.com/v1/messages"
          : "https://api.openai.com/v1/models");

      const headers: Record<string, string> = {};
      if (value.provider === "openai" || value.provider === "muse" || value.provider === "custom") {
        headers["Authorization"] = `Bearer ${value.apiKey}`;
      }
      if (value.provider === "anthropic") {
        headers["x-api-key"] = value.apiKey;
        headers["anthropic-version"] = "2023-06-01";
      }

      const res = await fetch(endpoint, { method: "GET", headers });
      if (res.ok || res.status === 400 || res.status === 405) {
        setTestResult(`✅ Connected to ${value.provider.toUpperCase()} (${res.status})`);
      } else if (res.status === 401 || res.status === 403) {
        setTestResult("❌ Invalid API key or permission denied");
      } else {
        setTestResult(`⚠️ Server responded ${res.status}`);
      }
    } catch (e: any) {
      setTestResult(`❌ Network / CORS error: ${e.message || "failed"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl bg-[#121212] px-3.5 py-3 text-sm font-bold"
      >
        <span className="flex items-center gap-2">
          <KeyRound size={16} className="text-[#007DFE]" />
          AI API Settings
        </span>
        <ChevronDown
          size={18}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-3 rounded-2xl border border-[#2e3440] bg-[#151820] p-4">
          <label className="block">
            <span className="text-xs font-semibold text-[#a9b0bc]">Provider</span>
            <select
              value={value.provider}
              onChange={(e) => {
                const p = e.target.value as AiProvider;
                update({
                  provider: p,
                  model: MODEL_OPTIONS[p][0].value,
                });
              }}
              className="mt-1.5 w-full rounded-xl border border-[#343a46] bg-[#121212] px-3 py-2.5 text-sm outline-none focus:border-[#007DFE]"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="muse">Muse (Meta)</option>
              <option value="custom">Custom Endpoint</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[#a9b0bc]">API Key</span>
            <input
              type="password"
              value={value.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={
                value.provider === "openai"
                  ? "sk-..."
                  : value.provider === "anthropic"
                  ? "sk-ant-..."
                  : "Paste your API key"
              }
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-[#343a46] bg-[#121212] px-3.5 py-2.5 text-sm outline-none focus:border-[#007DFE]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[#a9b0bc]">Model</span>
            <select
              value={value.model}
              onChange={(e) => update({ model: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[#343a46] bg-[#121212] px-3 py-2.5 text-sm outline-none focus:border-[#007DFE]"
            >
              {MODEL_OPTIONS[value.provider].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[#a9b0bc]">
              Base URL / Endpoint{" "}
              <span className="text-[#767e8b]">(optional)</span>
            </span>
            <input
              type="url"
              value={value.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder={
                value.provider === "openai"
                  ? "https://api.openai.com/v1"
                  : value.provider === "anthropic"
                  ? "https://api.anthropic.com"
                  : "Leave empty for default"
              }
              className="mt-1.5 w-full rounded-xl border border-[#343a46] bg-[#121212] px-3.5 py-2.5 text-sm outline-none focus:border-[#007DFE]"
            />
          </label>

          <div className="flex items-center justify-between rounded-xl bg-[#121212] px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold">Demo Mode</p>
              <p className="text-xs text-[#767e8b]">
                Uses a safe sample OCR result (no API call)
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={value.demoMode}
              onClick={() => update({ demoMode: !value.demoMode })}
              className={cn(
                "relative h-7 w-12 rounded-full transition-colors",
                value.demoMode ? "bg-[#007DFE]" : "bg-[#3a4150]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all",
                  value.demoMode ? "left-[22px]" : "left-0.5"
                )}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#343a46] bg-[#1a1d22] py-2.5 text-sm font-semibold hover:bg-[#22262e] disabled:opacity-50"
          >
            {testing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Testing…
              </>
            ) : (
              <>
                <Zap size={16} /> Test Connection
              </>
            )}
          </button>

          {testResult && (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium",
                testResult.startsWith("✅")
                  ? "bg-emerald-500/10 text-emerald-300"
                  : testResult.startsWith("❌")
                  ? "bg-red-500/10 text-red-300"
                  : "bg-amber-500/10 text-amber-300"
              )}
            >
              {testResult}
            </p>
          )}

          <p className="text-[11px] leading-4 text-[#767e8b]">
            Recommended: set <code className="text-[#a9b0bc]">OPENAI_API_KEY</code> or{" "}
            <code className="text-[#a9b0bc]">ANTHROPIC_API_KEY</code> in Vercel
            environment variables. Client key is only for testing.
          </p>
        </div>
      )}
    </div>
  );
}

export function loadAiSettings(): AiSettings {
  if (typeof window === "undefined") {
    return {
      provider: "openai",
      apiKey: "",
      model: "gpt-4o",
      baseUrl: "",
      demoMode: true,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        provider: s.provider || "openai",
        apiKey: s.apiKey || "",
        model: s.model || "gpt-4o",
        baseUrl: s.baseUrl || "",
        demoMode: typeof s.demoMode === "boolean" ? s.demoMode : true,
      };
    }
  } catch {}
  return {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o",
    baseUrl: "",
    demoMode: true,
  };
}
