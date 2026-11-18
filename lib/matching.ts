import type { CheckItem, OcrResult, Order } from "./types";

export const normalizeRef = (v: string) => (v || "").replace(/\D/g, "");

export const normalizeName = (name: string) =>
  (name || "")
    .replace(/[•*xX·]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Loose match: visible letters of the shorter name appear in order inside the longer one */
export function namesLooselyMatch(receiptName: string, expectedName: string): boolean {
  const a = normalizeName(receiptName);
  const b = normalizeName(expectedName);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;

  let i = 0;
  for (const ch of longer) {
    if (ch === shorter[i]) i++;
    if (i === shorter.length) return true;
  }
  return false;
}

export function amountsMatch(
  receiptAmt: number,
  expectedAmt: number,
  tolerance = 1
): boolean {
  if (Number.isNaN(receiptAmt) || Number.isNaN(expectedAmt)) return false;
  return Math.abs(receiptAmt - expectedAmt) <= tolerance;
}

export function fmtPeso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH")}`;
}

/**
 * Production-grade verification checks.
 * Critical checks must pass for auto-approve.
 * Soft checks are informational / warnings.
 */
export function buildChecks(
  receipt: OcrResult,
  order: Order,
  typedRef = ""
): CheckItem[] {
  const amountPass = amountsMatch(receipt.amount, order.amount, 1);
  const typedPass =
    !typedRef.trim() ||
    (normalizeRef(typedRef) === normalizeRef(receipt.ref_no) &&
      normalizeRef(typedRef).length >= 8);

  // Real GCash refs are usually 10–13 digits
  const refPass = normalizeRef(receipt.ref_no).length >= 10;

  const receiverPass = namesLooselyMatch(receipt.receiver_name, order.qrReceiver);

  const mobilePass =
    !order.qrMobile || !receipt.receiver_number
      ? true
      : normalizeRef(receipt.receiver_number).slice(-4) ===
        normalizeRef(order.qrMobile).slice(-4);

  // Optional: if order has an expectedRef, treat mismatch as soft warning only
  const expectedRefPass =
    !order.expectedRef ||
    normalizeRef(receipt.ref_no) === normalizeRef(order.expectedRef);

  return [
    {
      n: 1,
      label: "Amount",
      expected: fmtPeso(order.amount),
      receipt: fmtPeso(receipt.amount),
      pass: amountPass,
      critical: true,
      reason: amountPass
        ? ""
        : `Amount mismatch: Expected ${fmtPeso(order.amount)}, Receipt ${fmtPeso(receipt.amount)}`,
    },
    {
      n: 2,
      label: "Receiver Name",
      expected: order.qrReceiver,
      receipt: receipt.receiver_name,
      pass: receiverPass,
      critical: true,
      reason: receiverPass
        ? ""
        : `Receiver mismatch: Receipt shows “${receipt.receiver_name}”, expected “${order.qrReceiver}”`,
    },
    {
      n: 3,
      label: "Reference Number",
      expected: "Valid GCash Ref (≥10 digits)",
      receipt: receipt.ref_no || "—",
      pass: refPass,
      critical: true,
      reason: refPass ? "" : "OCR did not extract a valid reference number",
    },
    {
      n: 4,
      label: "Typed Ref (optional)",
      expected: typedRef || "— (not required for auto)",
      receipt: receipt.ref_no || "—",
      pass: typedPass,
      critical: false,
      reason: typedPass ? "" : "Typed reference does not match OCR reference",
    },
    {
      n: 5,
      label: "Mobile last-4",
      expected: order.qrMobile || "—",
      receipt: receipt.receiver_number || "—",
      pass: mobilePass,
      critical: false,
      reason: mobilePass ? "" : "Last 4 digits of mobile do not match",
    },
    {
      n: 6,
      label: "Expected Ref (optional)",
      expected: order.expectedRef || "—",
      receipt: receipt.ref_no || "—",
      pass: expectedRefPass,
      critical: false,
      reason: expectedRefPass
        ? ""
        : `OCR ref does not match pre-known expected ref ${order.expectedRef}`,
    },
  ];
}

export function getCriticalFailures(checks: CheckItem[]) {
  return checks.filter((c) => c.critical && !c.pass);
}

export function getSoftFailures(checks: CheckItem[]) {
  return checks.filter((c) => !c.critical && !c.pass);
}

export function allCriticalPass(checks: CheckItem[]) {
  return getCriticalFailures(checks).length === 0;
}
