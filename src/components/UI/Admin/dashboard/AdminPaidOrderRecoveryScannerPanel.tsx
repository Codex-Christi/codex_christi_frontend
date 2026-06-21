'use client';

import { useMemo, useState, useTransition } from 'react';
import { CheckSquare, Play, RotateCw, SearchCheck, Square } from 'lucide-react';
import { toast } from 'sonner';
import {
  runSelectedAdminPaidOrderRecoveryAction,
  scanAdminPaidOrderRecoveryCandidatesAction,
  type AdminRecoveryScannerActionResult,
} from '@/app/admin/(dashboard)/shop/paid-order-recovery/actions';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import type { AdminIcon } from './adminShopDashboardTypes';

type ScannerCandidate = Extract<
  AdminRecoveryScannerActionResult,
  { ok: true }
>['scan']['candidates'][number];

export default function AdminPaidOrderRecoveryScannerPanel() {
  const [scan, setScan] = useState<AdminRecoveryScannerActionResult['scan'] | null>(null);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const candidates = scan?.candidates ?? [];
  const selectedSet = useMemo(() => new Set(selectedTokens), [selectedTokens]);
  const allVisibleSelected =
    candidates.length > 0 && candidates.every((candidate) => selectedSet.has(candidate.orderToken));

  const handleScan = () => {
    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Scanning recovery rows',
        message: 'Checking eligible post-capture ledger rows.',
      });

      try {
        const result = await scanAdminPaidOrderRecoveryCandidatesAction();
        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({ header: 'Scan failed', message: result.error });
          return;
        }

        setScan(result.scan);
        setSelectedTokens(result.scan.candidates.map((candidate) => candidate.orderToken));
        successToast({ header: 'Scan complete', message: result.message });
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Scan failed',
          message: error instanceof Error ? error.message : 'Scan failed.',
        });
      }
    });
  };

  const runSelected = (orderTokens: string[]) => {
    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Running selected recovery',
        message: 'Processing selected ledger rows sequentially.',
      });

      try {
        const result = await runSelectedAdminPaidOrderRecoveryAction({ orderTokens });
        toast.dismiss(toastId);

        if (result.scan) {
          setScan(result.scan);
        }

        if (!result.ok) {
          errorToast({ header: 'Recovery incomplete', message: result.error });
          return;
        }

        setSelectedTokens([]);
        successToast({ header: 'Recovery complete', message: result.message });
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Recovery failed',
          message: error instanceof Error ? error.message : 'Recovery failed.',
        });
      }
    });
  };

  const toggleCandidate = (orderToken: string) => {
    setSelectedTokens((current) =>
      current.includes(orderToken)
        ? current.filter((token) => token !== orderToken)
        : [...current, orderToken],
    );
  };

  const toggleAllVisible = () => {
    setSelectedTokens(
      allVisibleSelected ? [] : candidates.map((candidate) => candidate.orderToken),
    );
  };

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3'>
        <div>
          <h2 className='text-base font-semibold text-white'>Recovery Scanner</h2>
          <p className='mt-1 text-xs text-slate-500'>
            {scan
              ? `${scan.candidates.length} candidate${scan.candidates.length === 1 ? '' : 's'} · ${scan.results.length} result${scan.results.length === 1 ? '' : 's'}`
              : 'No scan loaded'}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <ScannerButton icon={SearchCheck} onClick={handleScan} disabled={isPending}>
            {isPending ? 'Working...' : 'Dry Run'}
          </ScannerButton>
          <ScannerButton
            icon={Play}
            tone='cyan'
            onClick={() => runSelected(selectedTokens)}
            disabled={isPending || selectedTokens.length === 0}
          >
            Run Selected
          </ScannerButton>
          <ScannerButton
            icon={RotateCw}
            onClick={() => runSelected(candidates.map((candidate) => candidate.orderToken))}
            disabled={isPending || candidates.length === 0}
          >
            Run Visible
          </ScannerButton>
        </div>
      </div>

      <div className='grid gap-3 p-4'>
        <div className='grid gap-2 sm:grid-cols-4'>
          <ScannerMetric label='Min age' value={scan ? `${scan.minAgeMinutes}m` : '—'} />
          <ScannerMetric label='Batch' value={scan ? String(scan.batchSize) : '—'} />
          <ScannerMetric label='Selected' value={String(selectedTokens.length)} />
          <ScannerMetric label='Last scan' value={scan ? formatScanTime(scan.scannedAt) : '—'} />
        </div>

        <div className='overflow-x-auto rounded-lg border border-white/10'>
          <table className='w-full min-w-[920px] border-collapse text-left text-sm'>
            <thead className='bg-white/[0.03] text-[11px] uppercase tracking-[0.08em] text-slate-400'>
              <tr>
                <th className='w-[52px] px-3 py-3 font-medium'>
                  <button
                    type='button'
                    aria-label={
                      allVisibleSelected ? 'Deselect all visible rows' : 'Select all visible rows'
                    }
                    onClick={toggleAllVisible}
                    disabled={!candidates.length}
                    className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-200 disabled:opacity-40'
                  >
                    {allVisibleSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                </th>
                <th className='px-3 py-3 font-medium'>Order Token</th>
                <th className='px-3 py-3 font-medium'>Status</th>
                <th className='px-3 py-3 font-medium'>Customer</th>
                <th className='px-3 py-3 font-medium'>Updated</th>
                <th className='px-3 py-3 font-medium'>Reason</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-white/10'>
              {candidates.length ? (
                candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.orderToken}
                    candidate={candidate}
                    selected={selectedSet.has(candidate.orderToken)}
                    onToggle={() => toggleCandidate(candidate.orderToken)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className='px-4 py-6 text-center text-sm text-slate-500'>
                    {scan
                      ? 'No eligible scanner candidates.'
                      : 'Run a dry scan to load candidates.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {scan?.results.length ? (
          <div className='rounded-lg border border-white/10 bg-slate-950/24 p-3'>
            <p className='text-xs uppercase tracking-[0.08em] text-slate-500'>Latest Results</p>
            <div className='mt-3 grid gap-2'>
              {scan.results.map((result) => (
                <div
                  key={result.orderToken}
                  className={cn(
                    'rounded-md border px-3 py-2 text-xs',
                    result.ok
                      ? 'border-emerald-300/18 bg-emerald-300/[0.06] text-emerald-100'
                      : 'border-amber-300/18 bg-amber-300/[0.06] text-amber-100',
                  )}
                >
                  <span className='font-mono'>{result.orderToken.slice(0, 12)}</span>
                  <span className='mx-2 text-slate-500'>→</span>
                  <span>{result.status ?? 'unavailable'}</span>
                  {result.error ? (
                    <span className='ml-2 text-slate-300'>{result.error}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AdminGlassPanel>
  );
}

function CandidateRow({
  candidate,
  selected,
  onToggle,
}: {
  candidate: ScannerCandidate;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className='bg-slate-950/18 text-slate-300'>
      <td className='px-3 py-3'>
        <button
          type='button'
          aria-label={
            selected ? `Deselect ${candidate.orderToken}` : `Select ${candidate.orderToken}`
          }
          onClick={onToggle}
          className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-200'
        >
          {selected ? <CheckSquare size={15} /> : <Square size={15} />}
        </button>
      </td>
      <td className='px-3 py-3 font-mono text-xs text-cyan-100'>{candidate.orderToken}</td>
      <td className='px-3 py-3'>{candidate.status}</td>
      <td className='px-3 py-3'>{candidate.customerEmail}</td>
      <td className='px-3 py-3'>{formatScanTime(candidate.updatedAt)}</td>
      <td className='px-3 py-3'>{candidate.reason}</td>
    </tr>
  );
}

function ScannerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.03] p-3'>
      <p className='text-[11px] uppercase tracking-[0.08em] text-slate-500'>{label}</p>
      <p className='mt-2 text-sm font-medium text-slate-100'>{value}</p>
    </div>
  );
}

function ScannerButton({
  icon: Icon,
  children,
  disabled,
  onClick,
  tone,
}: {
  icon: AdminIcon;
  children: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'cyan';
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
        tone === 'cyan'
          ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/50 hover:bg-cyan-300/14'
          : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]',
      )}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

function formatScanTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
