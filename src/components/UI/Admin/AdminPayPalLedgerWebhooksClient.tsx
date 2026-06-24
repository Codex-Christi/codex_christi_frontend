'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  PowerOff,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import {
  savePayPalLedgerWebhookBindingAction,
  type PayPalLedgerWebhookBindingActionState,
} from '@/app/admin/(dashboard)/shop/paypal-webhooks/actions';
import showErrorToast from '@/lib/error-toast';
import type {
  PayPalLedgerWebhookDashboard,
  PayPalLedgerWebhookDashboardBinding,
} from '@/lib/paypal/txLedger/adminPayPalLedgerWebhooks';
import showSuccessToast from '@/lib/success-toast';
import { cn } from '@/lib/utils';
import AdminGlassPanel, { adminFieldClass } from './dashboard/AdminGlassPanel';

type AdminPayPalLedgerWebhooksClientProps = {
  dashboard: PayPalLedgerWebhookDashboard;
};

const initialState: PayPalLedgerWebhookBindingActionState = {
  error: null,
  messageId: null,
  success: null,
};

type StatusTone = 'amber' | 'cyan' | 'emerald' | 'rose' | 'slate';
type MetricTone = Exclude<StatusTone, 'slate'>;
type StatusPillProps = { label: string; tone: StatusTone; value: string };
type ValueBlockProps = { label: string; mono?: boolean; value: string };
type ActionButtonConfig = {
  icon: 'deactivate' | 'register' | 'sync';
  intent: 'deactivate' | 'register' | 'sync_env_to_db';
  label: string;
};

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  rose: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  slate: 'border-white/10 bg-white/[0.04] text-slate-300',
};

const METRIC_TONE_CLASS: Record<MetricTone, string> = {
  amber: 'text-amber-100',
  cyan: 'text-cyan-100',
  emerald: 'text-emerald-100',
  rose: 'text-rose-100',
};

export default function AdminPayPalLedgerWebhooksClient({
  dashboard,
}: AdminPayPalLedgerWebhooksClientProps) {
  const [state, formAction, pending] = useActionState(
    savePayPalLedgerWebhookBindingAction,
    initialState,
  );

  useEffect(() => {
    if (!state.messageId) return;

    if (state.error) {
      showErrorToast({
        header: 'Webhook update failed',
        message: state.error,
      });
      return;
    }

    if (state.success) {
      showSuccessToast({
        header: 'Webhook update saved',
        message: state.success,
      });
    }
  }, [state.error, state.messageId, state.success]);

  const overviewPills: StatusPillProps[] = [
    {
      label: 'Ledger DB',
      value: dashboard.databaseConfigured ? 'configured' : 'missing',
      tone: dashboard.databaseTarget.tone,
    },
    {
      label: 'Ledger branch',
      value: dashboard.databaseTarget.selectedBranch ?? 'none',
      tone: dashboard.databaseTarget.tone,
    },
    {
      label: 'Branch source',
      value: formatDatabaseSelectionSource(dashboard.databaseTarget.selectionSource),
      tone: dashboard.databaseTarget.selectionSource === 'fallback' ? 'amber' : 'slate',
    },
    {
      label: 'DB fingerprint',
      value: dashboard.databaseTarget.selectedUrlFingerprint ?? 'none',
      tone: dashboard.databaseTarget.selectedUrlFingerprint ? 'cyan' : 'rose',
    },
    {
      label: 'PayPal app',
      value: formatPayPalAppFingerprint(dashboard),
      tone: dashboard.paypalApp.currentClientIdConfigured ? 'cyan' : 'rose',
    },
    {
      label: 'Processing owner',
      value: dashboard.processingOwnership?.ownerLabel ?? 'unresolved',
      tone: dashboard.processingOwnership?.error
        ? 'rose'
        : dashboard.processingOwnership?.owner === 'none'
          ? 'amber'
          : 'emerald',
    },
    {
      label: 'Owner source',
      value: dashboard.processingOwnership
        ? `${dashboard.processingOwnership.source.replaceAll('_', ' ')} · ${dashboard.processingOwnership.envVarName}`
        : 'unresolved',
      tone:
        dashboard.processingOwnership?.source === 'invalid_env'
          ? 'rose'
          : dashboard.processingOwnership?.source === 'default'
            ? 'amber'
            : 'cyan',
    },
    {
      label: 'DB URL env',
      value: formatDatabaseUrlPresence(dashboard.databaseTarget),
      tone: dashboard.databaseTarget.prodDevUrlsMatch ? 'rose' : 'slate',
    },
    {
      label: 'Notifications',
      value: dashboard.summary.notificationDueCount
        ? `${dashboard.summary.notificationDueCount} queued`
        : 'clear',
      tone: dashboard.summary.notificationDueCount ? 'amber' : 'emerald',
    },
  ];

  return (
    <div className='px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <section className='mx-auto max-w-[1600px] space-y-4'>
        <Link
          href='/admin/shop'
          className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
        >
          <ArrowLeft size={16} />
          Shop dashboard
        </Link>

        <div className='grid gap-3 md:grid-cols-5'>
          <MetricCard label='Activation' value={dashboard.activationSource} tone='cyan' />
          <MetricCard
            label='Payment Mode'
            value={dashboard.currentPaymentMode ?? 'missing'}
            tone={dashboard.currentPaymentMode ? 'emerald' : 'rose'}
          />
          <MetricCard
            label='Active DB'
            value={`${dashboard.summary.activeDbBindings}`}
            tone={dashboard.summary.activeDbBindings ? 'emerald' : 'amber'}
          />
          <MetricCard
            label='Env Drift'
            value={`${dashboard.summary.driftCount + dashboard.summary.envMissingCount}`}
            tone={
              dashboard.summary.envMissingCount
                ? 'rose'
                : dashboard.summary.driftCount
                  ? 'amber'
                  : 'emerald'
            }
          />
          <MetricCard
            label='DB Target'
            value={dashboard.databaseTarget.label}
            tone={dashboard.databaseTarget.tone}
          />
        </div>

        <AdminGlassPanel className='p-4 sm:p-5'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='min-w-0'>
              <div className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100'>
                <ShieldCheck size={14} />
                PayPal Ledger Webhooks
              </div>
              <h2 className='mt-3 text-base font-semibold text-white'>
                Ledger transaction webhook trust
              </h2>
              <p className='mt-1 max-w-3xl text-sm leading-6 text-slate-400'>
                Runtime verification can trust registered env or DB webhook IDs, but only the
                configured processing owner mutates the ledger. Non-owner deliveries are
                acknowledged and ignored.
              </p>
            </div>

            <div className='grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:min-w-[620px] xl:grid-cols-3'>
              {overviewPills.map((pill) => (
                <StatusPill key={pill.label} {...pill} />
              ))}
            </div>
          </div>

          {dashboard.paymentModeError ? (
            <p className='mt-4 rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm leading-6 text-rose-100'>
              {dashboard.paymentModeError}
            </p>
          ) : null}
          {dashboard.safetyWarnings.length ? (
            <div className='mt-4 space-y-2'>
              {dashboard.safetyWarnings.map((warning) => (
                <div
                  key={warning.code}
                  className={cn(
                    'flex gap-2 rounded-lg border px-3 py-2 text-sm leading-6',
                    warning.severity === 'critical'
                      ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
                      : 'border-amber-300/20 bg-amber-300/10 text-amber-100',
                  )}
                >
                  <AlertTriangle size={16} className='mt-1 shrink-0' />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          ) : null}
          {state.error || state.success ? (
            <p className='sr-only' aria-live='polite'>
              {state.error ?? state.success}
            </p>
          ) : null}

          <div className='mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-2 xl:grid-cols-3'>
            {dashboard.requiredEvents.map((eventName) => (
              <span
                key={eventName}
                className='rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-slate-300'
              >
                {eventName}
              </span>
            ))}
          </div>
        </AdminGlassPanel>

        <div className='grid gap-4 xl:grid-cols-3'>
          {dashboard.rows.map((row) => (
            <WebhookBindingCard key={row.key} pending={pending} row={row} formAction={formAction} />
          ))}
        </div>
      </section>
    </div>
  );
}

function formatDatabaseSelectionSource(
  source: PayPalLedgerWebhookDashboard['databaseTarget']['selectionSource'],
) {
  return source.replaceAll('_', ' ');
}

function formatDatabaseUrlPresence(target: PayPalLedgerWebhookDashboard['databaseTarget']) {
  const prod = target.prodUrlConfigured ? 'prod set' : 'prod missing';
  const dev = target.devUrlConfigured ? 'dev set' : 'dev missing';

  return `${prod} · ${dev}`;
}

function formatPayPalAppFingerprint(dashboard: PayPalLedgerWebhookDashboard) {
  const mode = dashboard.currentPaymentMode ?? 'missing';
  const fingerprint = dashboard.paypalApp.currentClientIdFingerprint ?? 'none';

  return `${mode} ${fingerprint}`;
}

function WebhookBindingCard({
  formAction,
  pending,
  row,
}: {
  formAction: (payload: FormData) => void;
  pending: boolean;
  row: PayPalLedgerWebhookDashboardBinding;
}) {
  const canSyncEnvToDb = Boolean(row.envWebhookId && !row.dbWebhookId);
  const valueBlocks: ValueBlockProps[] = [
    { label: 'Env variable', value: row.envVarName, mono: true },
    { label: 'Runtime env value', value: row.envWebhookId ?? 'not set', mono: true },
    { label: 'Latest DB value', value: row.dbWebhookId ?? 'not set', mono: true },
    { label: 'Webhook URL', value: row.webhookUrl ?? 'not set' },
    { label: 'Expected URL', value: row.expectedUrl ?? 'ngrok/custom target' },
  ];
  const actions: ActionButtonConfig[] = [
    ...(canSyncEnvToDb
      ? [{ intent: 'sync_env_to_db', icon: 'sync', label: 'Sync env to DB' } as const]
      : []),
    { intent: 'register', icon: 'register', label: 'Register / Patch' },
    { intent: 'deactivate', icon: 'deactivate', label: 'Disable DB' },
  ];

  return (
    <AdminGlassPanel className='flex min-h-[520px] flex-col p-4 sm:p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-base font-semibold text-white'>{row.label}</h3>
            <span
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
                row.isActive
                  ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-400',
              )}
            >
              {row.isActive ? 'active' : 'inactive'}
            </span>
            {row.isProcessingOwner ? (
              <span className='rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100'>
                owner
              </span>
            ) : row.activationRelevant ? (
              <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400'>
                ack-only
              </span>
            ) : null}
          </div>
          <p className='mt-1 text-xs text-slate-500'>
            {row.paypalPaymentMode} · {row.deploymentTarget.replaceAll('_', ' ')}
          </p>
        </div>
        <StatusIcon tone={row.syncTone} />
      </div>

      <div className='mt-4 grid gap-2 text-xs'>
        <StatusPill label='Sync' value={row.syncStatusLabel} tone={row.syncTone} />
        <StatusPill
          label='Current mode'
          value={row.activationRelevant ? 'relevant' : 'not selected'}
          tone={row.activationRelevant ? 'cyan' : 'slate'}
        />
        <StatusPill
          label='Processing'
          value={row.isProcessingOwner ? 'owner' : row.activationRelevant ? 'ack-only' : 'ignored'}
          tone={row.isProcessingOwner ? 'emerald' : row.activationRelevant ? 'cyan' : 'slate'}
        />
      </div>

      <div className='mt-4 space-y-3'>
        {valueBlocks.map((block) => (
          <ValueBlock key={block.label} {...block} />
        ))}
      </div>

      {row.dbWebhookId ? (
        <div className='mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3'>
          <p className='text-xs font-semibold uppercase tracking-[0.12em] text-amber-100'>
            Env counterpart
          </p>
          <p className='mt-2 break-all font-mono text-xs leading-5 text-amber-50'>
            {row.envSuggestedLine}
          </p>
        </div>
      ) : null}

      <form action={formAction} className='mt-auto space-y-3 pt-5'>
        <input type='hidden' name='key' value={row.key} />
        <label className='block'>
          <span className='text-xs font-medium text-slate-400'>Webhook URL</span>
          <input
            name='webhookUrl'
            defaultValue={row.webhookUrl ?? ''}
            className={cn(adminFieldClass, 'mt-1 w-full')}
            placeholder={row.expectedUrl ?? 'https://...'}
          />
        </label>
        <label className='block'>
          <span className='text-xs font-medium text-slate-400'>Master admin password</span>
          <input
            name='masterAdminPassword'
            type='password'
            autoComplete='current-password'
            className={cn(adminFieldClass, 'mt-1 w-full')}
            placeholder='Required for every change'
          />
        </label>

        <div className='grid gap-2 sm:grid-cols-2'>
          {actions.map((action) => (
            <ActionButton key={action.intent} {...action} pending={pending} />
          ))}
        </div>
      </form>
    </AdminGlassPanel>
  );
}

function ActionButton({ icon, intent, label, pending }: ActionButtonConfig & { pending: boolean }) {
  const Icon = icon === 'register' ? Webhook : icon === 'sync' ? Database : PowerOff;

  return (
    <button
      type='submit'
      name='intent'
      value={intent}
      disabled={pending}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        intent === 'register'
          ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
          : intent === 'sync_env_to_db'
            ? 'border border-amber-300/20 bg-amber-300/10 text-amber-100 hover:border-amber-200/40'
            : 'border border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-300/30',
      )}
    >
      {pending ? <Loader2 size={16} className='animate-spin' /> : <Icon size={16} />}
      {label}
    </button>
  );
}

function MetricCard({ label, tone, value }: { label: string; tone: MetricTone; value: string }) {
  return (
    <AdminGlassPanel className='p-4'>
      <p className='text-xs uppercase tracking-[0.12em] text-slate-500'>{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tracking-normal', METRIC_TONE_CLASS[tone])}>
        {value}
      </p>
    </AdminGlassPanel>
  );
}

function StatusPill({ label, tone, value }: StatusPillProps) {
  return (
    <div className={cn('rounded-lg border px-3 py-2', STATUS_TONE_CLASS[tone])}>
      <span className='block text-[11px] uppercase tracking-[0.12em] opacity-70'>{label}</span>
      <span className='mt-1 block text-sm font-semibold'>{value}</span>
    </div>
  );
}

function StatusIcon({ tone }: { tone: PayPalLedgerWebhookDashboardBinding['syncTone'] }) {
  const Icon = tone === 'emerald' ? CheckCircle2 : tone === 'slate' ? Database : AlertTriangle;

  return (
    <span
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-lg border',
        STATUS_TONE_CLASS[tone],
      )}
    >
      <Icon size={18} />
    </span>
  );
}

function ValueBlock({ label, mono = false, value }: ValueBlockProps) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.03] p-3'>
      <div className='flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-500'>
        {mono ? <KeyRound size={12} /> : null}
        {label}
      </div>
      <p
        className={cn(
          'mt-2 min-h-[20px] break-all text-sm leading-5 text-slate-200',
          mono && 'font-mono text-xs text-cyan-100',
        )}
      >
        {value}
      </p>
    </div>
  );
}
