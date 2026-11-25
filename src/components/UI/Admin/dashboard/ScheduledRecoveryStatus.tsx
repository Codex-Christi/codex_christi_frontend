import type { ScheduledRecoveryRunStatus } from '@/lib/paypal/txLedger/scheduledRecoveryRun';

const utcDate = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function RunTime({ value }: { value: string }) {
  return <time dateTime={value}>{utcDate.format(new Date(value))} UTC</time>;
}

export default function ScheduledRecoveryStatus({ run }: { run: ScheduledRecoveryRunStatus }) {
  return (
    <section aria-label='Scheduled recovery' className='border-b border-white/10 px-4 py-3 text-sm'>
      <h3 className='font-semibold text-white'>Scheduled recovery</h3>
      <dl className='mt-2 flex flex-wrap gap-x-8 gap-y-2 text-slate-200'>
        <div>
          <dt className='text-xs text-slate-400'>Latest run</dt>
          <dd>
            {run.unavailable ? 'Status unavailable' : run.latest ? (
              <>
                <RunTime value={run.latest.at} />
                {' · '}
                {run.latest.outcome === 'success' ? 'Completed' : 'Needs attention'}
              </>
            ) : 'None recorded'}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-slate-400'>Last successful run</dt>
          <dd>
            {run.lastSuccessAt ? <RunTime value={run.lastSuccessAt} /> :
              run.unavailable ? 'Status unavailable' : 'None recorded'}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-slate-400'>Automatic payment recovery</dt>
          <dd>
            {run.paymentRetries === 'enabled' ? 'Enabled' :
              run.paymentRetries === 'disabled' ? 'Disabled' : 'Not configured'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
