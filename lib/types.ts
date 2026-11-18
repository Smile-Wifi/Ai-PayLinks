export type OcrResult = {
  receiver_name: string;
  receiver_number: string;
  amount: number;
  total_amount_sent: number;
  ref_no: string;
  date: string;
  payment_method: string;
  raw?: string;
};

export type CheckItem = {
  n: number;
  label: string;
  expected: string;
  receipt: string;
  pass: boolean;
  critical: boolean;
  reason: string;
};

export type Order = {
  id: string;
  amount: number;
  event: string;
  datetime: string;
  customer: string;
  customerMobile: string;
  expectedRef?: string;
  qrReceiver: string;
  qrMobile: string;
  qrUserId?: string;
};

export type HistoryEntry = {
  id: string;
  created_at: string;
  orderId: string;
  action: "Verified" | "Rejected";
  note: string;
  aiResult: string;
  amountChecked: string;
  refNo?: string;
  decisionTime?: string;
  approvedLink?: string;
  checks?: { label: string; pass: boolean; critical: boolean }[];
  source?: "manual" | "auto" | "messenger" | "side";
};

export type DecisionInfo = {
  action: "Verified" | "Rejected";
  refNo: string;
  timeISO: string;
  link: string;
  note: string;
};

export type AiProvider = "openai" | "anthropic" | "muse" | "custom";

export type AiSettings = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  demoMode: boolean;
};
