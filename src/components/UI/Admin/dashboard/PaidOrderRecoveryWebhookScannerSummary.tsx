import { AlertTriangle, CheckCircle2, Clock3, Radar, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPayPalLedgerWebhookSourceLabel } from '@/lib/paypal/txLedger/paypalLedgerProvenance';
import type { PaidOrderRecoveryDetail } from './adminShopDashboardTypes';

type PaidOrderRecoveryWebhookScannerSummaryProps = {
  detail: PaidOrderRecoveryDetail;
};

export default function PaidOrderRecoveryWebhookScannerSummary({
  detail,
}: PaidOrderRecoveryWebhookScannerSummaryProps) {
  const latestWebhook = detail.webhookEvents[0];
  const latestWebhookSource = latestWebhook
    ? getPayPalLedgerWebhookSourceLabel(latestWebhook, 'unrecorded webhook source')
    : null;
  const scannerIsEligible = detail.scannerState.eligible;

  return (
    <section className='rounded-xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-xs uppercase tracking-[0.12em] text-cyan-100/75'>Webhook & Scanner</p>
          <h3 className='mt-1 text-sm font-semibold text-white'>Backend delivery status</h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]',
            scannerIsEligible
              ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
              : 'border-slate-300/15 bg-slate-300/8 text-slate-300',
          )}
        >
          {scannerIsEligible ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
          {scannerIsEligible ? 'Scanner candidate' : 'Not a candidate'}
        </span>
      </div>

      <div className='grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
        <StatusTile
          icon={Radar}
          label='Recovery scanner'
          value={scannerIsEligible ? 'Eligible for backend recovery' : 'Not currently eligible'}
          detail={detail.scannerState.reason}
          tone={scannerIsEligible ? 'amber' : 'slate'}
        />

        <div className='rounded-lg border border-white/10 bg-slate-950/30 p-3'>
          <div className='flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-500'>
            <Webhook size={13} />
            Latest webhook
          </div>
          {latestWebhook ? (
            <div className='mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium text-slate-100'>
                  {latestWebhook.eventType}
                </p>
                <p className='mt-1 text-xs text-slate-500'>
                  {latestWebhook.processingStatus} · attempts {latestWebhook.attemptCount}
                </p>
                <p className='mt-2 text-xs leading-5 text-slate-400'>
                  Accepted via {latestWebhookSource}
                  {latestWebhook.webhookVerificationMode
                    ? ` · ${latestWebhook.webhookVerificationMode} verification`
                    : ''}
                </p>
                {latestWebhook.matchedWebhookId ? (
                  <p className='mt-1 font-mono text-[11px] text-cyan-100'>
                    {latestWebhook.matchedWebhookId}
                  </p>
                ) : null}
              </div>
              <div className='flex items-center gap-2 text-xs text-slate-500 sm:justify-end'>
                <Clock3 size={13} />
                <span>
                  {latestWebhook.processedAt ??
                    latestWebhook.lastAttemptAt ??
                    latestWebhook.createdAt}
                </span>
              </div>
              {latestWebhook.lastErrorMessage ? (
                <p className='rounded-md border border-rose-300/16 bg-rose-300/8 px-2.5 py-2 text-xs leading-5 text-rose-100 sm:col-span-2'>
                  {latestWebhook.lastErrorMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <p className='mt-3 text-sm text-slate-500'>No correlated webhook event stored.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Radar;
  label: string;
  value: string;
  detail: string;
  tone: 'amber' | 'slate';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        tone === 'amber'
          ? 'border-amber-300/20 bg-amber-300/[0.055]'
          : 'border-white/10 bg-slate-950/30',
      )}
    >
      <div className='flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-500'>
        <Icon size={13} />
        {label}
      </div>
      <p className='mt-3 text-sm font-medium text-slate-100'>{value}</p>
      <p className='mt-1 text-xs leading-5 text-slate-500'>{detail}</p>
    </div>
  );
}
