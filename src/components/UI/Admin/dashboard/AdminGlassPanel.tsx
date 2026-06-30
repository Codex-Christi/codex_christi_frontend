import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './AdminGlassPanel.module.css';

type AdminGlassPanelProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export const adminGlassPanelClass = styles.glassPanel;

export const adminInteractiveGlassPanelClass = styles.interactiveGlassPanel;

export const adminInsetSurfaceClass = styles.insetSurface;

export const adminFieldClass = styles.field;

export function getAdminGlassPanelClassName(
  className?: string,
  options: { interactive?: boolean } = {},
) {
  return cn(
    adminGlassPanelClass,
    options.interactive && adminInteractiveGlassPanelClass,
    className,
  );
}

export default function AdminGlassPanel({
  children,
  className,
  interactive = false,
}: AdminGlassPanelProps) {
  return <div className={getAdminGlassPanelClassName(className, { interactive })}>{children}</div>;
}
