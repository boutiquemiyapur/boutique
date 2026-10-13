export type RefundSettingsStatus = {
  codeEnabled: boolean; adminEnabled: boolean; effectiveEnabled: boolean; revision: number;
  updatedAt: string | null; updatedBy: string | null;
};
export type RefundSettingAudit = { enabled: boolean; revision: number; at: string; by: string };
export type ApprovedRefundReview = {
  orderId: string; paymentId?: string; amountPaise: number; currency: 'INR';
  state: string; refundId?: string; approvedAt?: string; canExecute: boolean;
  reason?: string; reviewId?: string; expiresAt?: string; settings: RefundSettingsStatus;
};
