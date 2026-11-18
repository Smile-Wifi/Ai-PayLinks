import Link from "next/link";

const SAMPLE_ORDERS = [
  {
    id: "PPM-4FB157",
    amount: 149,
    event: "Event Magic with Music",
    customer: "lycel",
  },
  {
    id: "PPM-8C2A91",
    amount: 299,
    event: "VIP Photo Booth",
    customer: "juan",
  },
  {
    id: "PPM-1D9E44",
    amount: 99,
    event: "Piso WiFi Voucher Pack",
    customer: "maria",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#007DFE]">
          AI PayLinks
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          GCash Verification CMS
        </h1>
        <p className="mt-3 max-w-xl text-[#a9b0bc]">
          Production-ready dashboard for verifying GCash payments with AI OCR,
          critical/soft checks, auto-confirm, and decision history. Deploy on
          Vercel in one click.
        </p>

        <div className="mt-10 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#767e8b]">
            Open a sample order
          </p>
          {SAMPLE_ORDERS.map((o) => (
            <Link
              key={o.id}
              href={`/verify/${o.id}`}
              className="flex items-center justify-between rounded-2xl border border-[#292d36] bg-[#1a1d22] px-4 py-4 transition hover:border-[#007DFE]/50 hover:bg-[#1e2229]"
            >
              <div>
                <p className="font-mono text-sm font-bold">{o.id}</p>
                <p className="mt-0.5 text-xs text-[#a9b0bc]">
                  {o.event} · {o.customer}
                </p>
              </div>
              <span className="font-semibold text-[#007DFE]">
                ₱{o.amount.toLocaleString("en-PH")}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[#292d36] bg-[#1a1d22] p-5 text-sm text-[#a9b0bc]">
          <p className="font-semibold text-white">Quick start</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Set <code className="text-[#a9b0bc]">OPENAI_API_KEY</code> or{" "}
              <code className="text-[#a9b0bc]">ANTHROPIC_API_KEY</code> in
              Vercel env
            </li>
            <li>Open any order above or go to /verify/YOUR-ORDER-ID</li>
            <li>Upload a GCash receipt → Scan → Auto Confirm or Approve</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
