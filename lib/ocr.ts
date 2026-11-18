import type { AiProvider, OcrResult } from "./types";

const SYSTEM_PROMPT = `You are an expert OCR system specialized in Philippine GCash payment receipts and screenshots.

Extract the following fields accurately and return ONLY a valid JSON object with these exact keys:
{
  "receiver_name": "string (name of the recipient, keep any masking characters like • or *)",
  "receiver_number": "string (mobile number if visible, otherwise empty)",
  "amount": number (the main transfer amount, numeric only),
  "total_amount_sent": number (total amount sent including fees if shown, otherwise same as amount),
  "ref_no": "string (the GCash Reference Number / Ref No.)",
  "date": "string (date and time as shown on the receipt)",
  "payment_method": "string (usually GCash)"
}

Rules:
- Do not invent values. If a field is not visible, use empty string or 0 for numbers.
- Amount must be a pure number (no ₱ or commas).
- ref_no should contain only digits if possible.
- Return pure JSON only. No markdown, no explanation.`;

export async function runOcr(params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  imageBase64?: string;
  imageUrl?: string;
}): Promise<OcrResult> {
  const { provider, apiKey, model, baseUrl, imageBase64, imageUrl } = params;

  if (!apiKey) {
    throw new Error("API key is required");
  }

  if (!imageBase64 && !imageUrl) {
    throw new Error("Either imageBase64 or imageUrl is required");
  }

  if (provider === "openai") {
    return callOpenAI({ apiKey, model, baseUrl, imageBase64, imageUrl });
  }

  if (provider === "anthropic") {
    return callAnthropic({ apiKey, model, baseUrl, imageBase64, imageUrl });
  }

  return callOpenAICompatible({
    apiKey,
    model,
    baseUrl: baseUrl || "https://api.openai.com/v1",
    imageBase64,
    imageUrl,
  });
}

async function callOpenAI(opts: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  imageBase64?: string;
  imageUrl?: string;
}): Promise<OcrResult> {
  const endpoint = (opts.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "") + "/chat/completions";

  const imageContent: any = opts.imageUrl
    ? { type: "image_url", image_url: { url: opts.imageUrl } }
    : {
        type: "image_url",
        image_url: {
          url: opts.imageBase64!.startsWith("data:")
            ? opts.imageBase64
            : `data:image/jpeg;base64,${opts.imageBase64}`,
        },
      };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the GCash receipt data from this image." },
            imageContent,
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return parseOcrJson(content);
}

async function callAnthropic(opts: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  imageBase64?: string;
  imageUrl?: string;
}): Promise<OcrResult> {
  const endpoint =
    (opts.baseUrl || "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages";

  let mediaType = "image/jpeg";
  let data = opts.imageBase64 || "";

  if (opts.imageBase64?.startsWith("data:")) {
    const match = opts.imageBase64.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (match) {
      mediaType = match[1];
      data = match[2];
    }
  }

  const content: any[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT + "\n\nExtract the GCash receipt data from this image.",
    },
  ];

  if (opts.imageUrl) {
    content.push({
      type: "image",
      source: { type: "url", url: opts.imageUrl },
    });
  } else {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data,
      },
    });
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || "claude-sonnet-4-20250514",
      max_tokens: 800,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  }

  const dataRes = await res.json();
  const textBlock = dataRes.content?.find((c: any) => c.type === "text");
  if (!textBlock?.text) throw new Error("Empty response from Anthropic");

  return parseOcrJson(textBlock.text);
}

async function callOpenAICompatible(opts: {
  apiKey: string;
  model: string;
  baseUrl: string;
  imageBase64?: string;
  imageUrl?: string;
}): Promise<OcrResult> {
  return callOpenAI({
    apiKey: opts.apiKey,
    model: opts.model,
    baseUrl: opts.baseUrl,
    imageBase64: opts.imageBase64,
    imageUrl: opts.imageUrl,
  });
}

function parseOcrJson(raw: string): OcrResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  return {
    receiver_name: String(parsed.receiver_name || ""),
    receiver_number: String(parsed.receiver_number || ""),
    amount: Number(parsed.amount) || 0,
    total_amount_sent: Number(parsed.total_amount_sent) || Number(parsed.amount) || 0,
    ref_no: String(parsed.ref_no || "").replace(/\s/g, ""),
    date: String(parsed.date || ""),
    payment_method: String(parsed.payment_method || "GCash"),
    raw: cleaned,
  };
}
