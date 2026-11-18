import { VerificationDashboard } from "@/components/VerificationDashboard";
import type { Order } from "@/lib/types";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * In production, fetch the real order from your database / PayLinks backend.
 * This page currently builds a sensible default from the orderId so the
 * dashboard is immediately usable.
 */
function resolveOrder(orderId: string): Order {
  const defaults: Record<string, Partial<Order>> = {
    "PPM-4FB157": {
      amount: 149,
      event: "Event Magic with Music",
      customer: "lycel",
      customerMobile: "9752765499",
      qrReceiver: "JO***N L.",
      qrMobile: "+63 975 276 ****",
    },
    "PPM-8C2A91": {
      amount: 299,
      event: "VIP Photo Booth",
      customer: "juan",
      customerMobile: "9171234567",
      qrReceiver: "JU***N D.",
      qrMobile: "+63 917 123 ****",
    },
    "PPM-1D9E44": {
      amount: 99,
      event: "Piso WiFi Voucher Pack",
      customer: "maria",
      customerMobile: "9187654321",
      qrReceiver: "MA***A S.",
      qrMobile: "+63 918 765 ****",
    },
  };

  const known = defaults[orderId] || {};

  return {
    id: orderId,
    amount: known.amount ?? 100,
    event: known.event ?? "Payment",
    datetime: new Date().toLocaleString("en-US"),
    customer: known.customer ?? "customer",
    customerMobile: known.customerMobile ?? "",
    qrReceiver: known.qrReceiver ?? "MERCHANT",
    qrMobile: known.qrMobile ?? "",
    expectedRef: known.expectedRef,
  };
}

export default async function VerifyPage({ params }: Props) {
  const { orderId } = await params;
  const order = resolveOrder(decodeURIComponent(orderId));

  return <VerificationDashboard order={order} />;
}
