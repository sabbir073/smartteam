import { supabase } from "./db";
import { format } from "date-fns";

/**
 * Calculate platform charge and net amount
 */
export function calculateOrderAmounts(
  grossAmount: number,
  chargePercentage: number
): { platformCharge: number; netAmount: number } {
  const platformCharge = Number(((grossAmount * chargePercentage) / 100).toFixed(2));
  const netAmount = Number((grossAmount - platformCharge).toFixed(2));
  return { platformCharge, netAmount };
}

/**
 * Generate the next order number in format: ORD-YYYYMM-XXXX
 */
export async function generateOrderNumber(): Promise<string> {
  const prefix = `ORD-${format(new Date(), "yyyyMM")}`;

  const { data } = await supabase
    .from("orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].order_number.split("-")[2], 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Calculate time remaining until deadline
 */
export function getTimeRemaining(deadline: string): {
  text: string;
  isOverdue: boolean;
  isUrgent: boolean;
} {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();

  if (diffMs < 0) {
    const overdueDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return {
      text: `${overdueDays}d overdue`,
      isOverdue: true,
      isUrgent: true,
    };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 1) {
    return { text: `${diffDays}d remaining`, isOverdue: false, isUrgent: diffDays <= 2 };
  }

  return { text: `${diffHours}h remaining`, isOverdue: false, isUrgent: true };
}
