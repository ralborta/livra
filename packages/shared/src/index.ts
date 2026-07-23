export type OrderStatus =
  | 'DRAFT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'DELIVERY_EXCEPTION'
  | 'CANCELLED';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'EXPIRED', 'CANCELLED'],
  PAID: ['ACCEPTED', 'REFUND_PENDING'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED', 'DELIVERY_EXCEPTION'],
  DELIVERED: [],
  EXPIRED: [],
  REFUND_PENDING: ['CANCELLED'],
  DELIVERY_EXCEPTION: ['IN_TRANSIT', 'CANCELLED'],
  CANCELLED: [],
};

export type LivraEventType =
  | 'order.created'
  | 'payment.approved'
  | 'order.accepted'
  | 'order.ready'
  | 'delivery.assigned'
  | 'delivery.location.updated'
  | 'delivery.completed'
  | 'settlement.generated';

export interface EventEnvelope<T = unknown> {
  event_id: string;
  event_type: LivraEventType;
  occurred_at: string;
  producer: string;
  schema_version: string;
  tenant_id: string;
  correlation_id: string;
  aggregate_id: string;
  aggregate_version: number;
  actor?: string;
  payload: T;
}
