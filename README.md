# AI PayLinks — GCash Verification CMS

Production-ready GCash payment verification dashboard with AI OCR, critical/soft matching, auto-confirm, and decision history.

**Vercel-compatible.** Deploy in one click.

## Features

- **Real AI OCR** — OpenAI GPT-4o / Anthropic Claude vision (server-side)
- **Smart matching** — fuzzy name matching, ₱1 amount tolerance, critical vs soft checks
- **Auto Confirm** — scan → verify → approve when critical checks pass
- **Manual override** — approve / decline with notes
- **Decision history** — per-order audit trail
- **AI settings panel** — provider, model, key, base URL, demo mode
- **Receipt upload** — no more hardcoded images

## Quick Start (local)

```bash
git clone https://github.com/Smile-Wifi/Ai-PayLinks.git
cd Ai-PayLinks
npm install
cp .env.example .env.local
# Add OPENAI_API_KEY=sk-... or ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open http://localhost:3000

## Deploy on Vercel

1. Import this repo in [Vercel](https://vercel.com/new)
2. Add environment variables:
   - `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY`
   - (optional) `NEXT_PUBLIC_APP_URL`
3. Deploy

After deploy, open `/verify/YOUR-ORDER-ID` or use the sample orders on the home page.

## How verification works

| Check              | Critical? | Logic                                      |
|--------------------|-----------|--------------------------------------------|
| Amount             | Yes       | Receipt amount within ₱1 of order amount   |
| Receiver Name      | Yes       | Fuzzy match against QR owner (handles • * masking) |
| Reference Number   | Yes       | Valid GCash ref (≥10 digits) extracted     |
| Typed Ref          | Soft      | Optional; must match OCR if provided       |
| Mobile last-4      | Soft      | Optional extra signal                      |
| Expected Ref       | Soft      | Only if you pre-know the ref               |

Auto-confirm only approves when **all critical checks pass** (unless override is enabled).

## Project structure

```
app/
  page.tsx                 # Home / sample orders
  verify/[orderId]/         # Verification dashboard
  api/ocr/                 # Server-side AI OCR
  api/verify/              # Server-side check builder
  api/history/             # Decision history
components/
  VerificationDashboard.tsx
  AiSettingsPanel.tsx
lib/
  matching.ts              # Production matching logic
  ocr.ts                   # OpenAI / Anthropic clients
  types.ts
```

## Connecting real orders

Replace the `resolveOrder()` helper in `app/verify/[orderId]/page.tsx` with a fetch to your database / PayLinks backend.

## History storage

The current `/api/history` uses an in-memory store (fine for demos and single-instance). For production persistence on Vercel, swap it for:

- [Upstash Redis](https://upstash.com)
- Vercel KV
- Neon / Postgres

## License

MIT
