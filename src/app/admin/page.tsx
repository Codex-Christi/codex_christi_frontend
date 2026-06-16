import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Not Found | Codex Christi Admin',
};

export default function AdminPage() {
  notFound();
}
