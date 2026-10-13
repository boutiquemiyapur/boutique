import type { Order } from '../types/index.js';

// Owner-approved on 2026-10-13. Shared display policy; backend rechecks atomically.
export const CANCELLABLE_STATUSES = ['Order Placed', 'Confirmed'] as const;
export const CANCELLATION_REASONS = ['Ordered by mistake', 'Wrong product or options', 'Delivery timing', 'Other'] as const;
export const cancellationStageEligible = (order: Order) => CANCELLABLE_STATUSES.some(status => status === order.orderStatus)
  && Array.isArray(order.timeline) && order.timeline.every(event => CANCELLABLE_STATUSES.some(status => status === event.status));
export const cancellationEligible = (order: Order) =>
  cancellationStageEligible(order)
  && !order.cancellation && !order.cancellationRequest
  && !['REFUNDED', 'REFUND_PENDING'].includes(order.paymentStatus);
export const cancellationHold = (order: Order) => order.orderStatus === 'Cancelled'
  || ['REQUESTED', 'APPROVED'].includes(order.cancellationRequest?.status || '');
