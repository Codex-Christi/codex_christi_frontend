import type { ComponentType, ReactNode } from 'react';

export type AdminShopScope = 'shop' | 'shop-order-recovery' | 'shop-catalog-snapshots';
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

export type OrderRecoveryRow = {
  orderToken: string;
  status: 'failed' | 'recovery' | 'pending' | 'completed';
  customer: string;
  amount: string;
  step: string;
  error: string;
  supportRef: string;
  updated: string;
};

export type TimelineItem = {
  label: string;
  time: string;
  state: 'done' | 'failed' | 'pending';
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
