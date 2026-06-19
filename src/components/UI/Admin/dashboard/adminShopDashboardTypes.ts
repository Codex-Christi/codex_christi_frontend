import type { ComponentType, ReactNode } from 'react';

export type AdminShopScope = 'shop' | 'shop-paid-order-recovery' | 'shop-catalog-snapshots';
export type ToolTone = 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'blue';
export type ToolState =
  | 'healthy'
  | 'action'
  | 'pending'
  | 'critical'
  | 'review'
  | 'ready'
  | 'open'
  | 'warning';

export type AdminIcon = ComponentType<{
  size?: number;
  className?: string;
}>;

export type MetricCard = {
  title: string;
  metric: string;
  caption: string;
  action: string;
  href?: string;
  icon: AdminIcon;
  state: ToolState;
  tone: ToolTone;
};

export type NavItem = {
  label: string;
  href?: string;
  icon: AdminIcon;
  count?: string;
};

export type PaidOrderRecoveryRow = {
  orderToken: string;
  status: 'failed' | 'recovery' | 'pending' | 'completed' | 'sync';
  customer: string;
  amount: string;
  step: string;
  error: string;
  supportRef: string;
  updated: string;
  needsProviderDetailSync?: boolean;
};

export type TimelineItem = {
  label: string;
  time: string;
  state: 'done' | 'failed' | 'pending';
};

export type PaidOrderRecoveryAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type PaidOrderRecoveryLineItem = {
  id: string;
  title: string;
  variant: string;
  quantity: number;
  unitPrice: string;
  image: string | null;
};

export type PaidOrderRecoveryReference = {
  label: string;
  value: string | null;
};

export type PaidOrderRecoveryActivityItem = {
  label: string;
  description: string;
  time: string;
  tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'cyan';
};

export type PaidOrderRecoveryDetail = {
  customerName: string;
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
  receiptLink: string | null;
  originalAddress: PaidOrderRecoveryAddress | null;
  activeAddress: PaidOrderRecoveryAddress | null;
  hasAddressOverride: boolean;
  addressOverrideReason: string | null;
  addressOverriddenAt: string | null;
  addressOverriddenBy: string | null;
  items: PaidOrderRecoveryLineItem[];
  references: PaidOrderRecoveryReference[];
  activity: PaidOrderRecoveryActivityItem[];
  rawDebug: Record<string, unknown>;
  needsProviderDetailSync: boolean;
};

export type AdminNotificationHistoryItem = {
  id: string;
  status: string;
  recipient: string | null;
  createdAt: string;
  sentAt: string | null;
  lastErrorMessage: string | null;
};

export type AdminChildrenProps = {
  children: ReactNode;
};
