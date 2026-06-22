import 'server-only';

import {
  getOptionalConfiguredPayPalPaymentMode,
  getPayPalLedgerWebhookActivationSource,
  getPayPalLedgerWebhookEnvValue,
  getPayPalLedgerWebhookExpectedUrl,
  PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS,
  PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS,
  type PayPalLedgerWebhookActivationSource,
  type PayPalLedgerWebhookBindingKey,
} from '@/lib/paypal/ledgerWebhookConfig';
import { registerPayPalLedgerWebhook } from '@/lib/paypal/payPalWebhookRegistry';
import {
  isPaypalTxLedgerDatabaseConfigured,
  paypalTxLedger,
} from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  enqueueAdminPayPalLedgerWebhookDriftNotification,
  sendPendingAdminNotificationsByDedupePrefix,
} from './adminNotificationOutbox';

export type PayPalLedgerWebhookSyncStatus =
  | 'db_missing'
  | 'drift'
  | 'env_missing'
  | 'in_sync'
  | 'missing_both';

export type PayPalLedgerWebhookDashboardBinding = {
  activatedAt: string | null;
  activationRelevant: boolean;
  dbWebhookId: string | null;
  deploymentTarget: string;
  envSuggestedLine: string;
  envVarName: string;
  envWebhookId: string | null;
  expectedUrl: string | null;
  isActive: boolean;
  key: PayPalLedgerWebhookBindingKey;
  label: string;
  lastCheckedAt: string | null;
  lastNotifiedAt: string | null;
  lastSyncSummary: string | null;
  notificationDue: boolean;
  paypalPaymentMode: 'sandbox' | 'live';
  syncStatus: PayPalLedgerWebhookSyncStatus;
  syncStatusLabel: string;
  syncTone: 'amber' | 'emerald' | 'rose' | 'slate';
  updatedAt: string | null;
  webhookUrl: string | null;
};

export type PayPalLedgerWebhookDashboard = {
  activationSource: PayPalLedgerWebhookActivationSource;
  currentPaymentMode: 'sandbox' | 'live' | null;
  databaseConfigured: boolean;
  generatedAt: string;
  paymentModeError: string | null;
  requiredEvents: string[];
  rows: PayPalLedgerWebhookDashboardBinding[];
  summary: {
    activeDbBindings: number;
    driftCount: number;
    envMissingCount: number;
    inSyncCount: number;
    notificationDueCount: number;
  };
};

export type SavePayPalLedgerWebhookBindingInput = {
  actorAdminUserId: string;
  actorCodexUserId: string;
  intent: 'activate' | 'deactivate' | 'save';
  key: string;
  webhookId?: string | null;
  webhookUrl?: string | null;
};

export type RegisterPayPalLedgerWebhookBindingInput = {
  actorAdminUserId: string;
  actorCodexUserId: string;
  key: string;
  webhookUrl: string;
};

export type SyncPayPalLedgerWebhookEnvToDbInput = {
  actorAdminUserId: string;
  actorCodexUserId: string;
  key: string;
  webhookUrl?: string | null;
};

export type RegisterPayPalLedgerWebhookBindingResult = {
  envVarName: string;
  label: string;
  paypalAction: 'created' | 'patched';
  paypalPaymentMode: 'sandbox' | 'live';
  previousWebhookIdSource: 'db' | 'env' | 'none';
  webhookId: string;
  webhookUrl: string;
};

export async function getPayPalLedgerWebhookDashboard({
  notifyOnDrift = false,
}: {
  notifyOnDrift?: boolean;
} = {}): Promise<PayPalLedgerWebhookDashboard> {
  const activationSource = getPayPalLedgerWebhookActivationSource();
  const paymentModeState = getOptionalConfiguredPayPalPaymentMode();
  const databaseConfigured = isPaypalTxLedgerDatabaseConfigured();
  const rows = await getPayPalLedgerWebhookDashboardRows({ databaseConfigured });

  if (databaseConfigured) {
    await updatePayPalLedgerWebhookBindingSyncState(rows);
  }

  if (notifyOnDrift && databaseConfigured) {
    await notifyPayPalLedgerWebhookDrift({ activationSource, rows });
  }

  const activeDbBindings = rows.filter((row) => row.isActive).length;
  const driftCount = rows.filter((row) => row.syncStatus === 'drift').length;
  const envMissingCount = rows.filter((row) => row.syncStatus === 'env_missing').length;
  const inSyncCount = rows.filter((row) => row.syncStatus === 'in_sync').length;
  const notificationDueCount = rows.filter((row) => row.notificationDue).length;

  return {
    activationSource,
    currentPaymentMode: paymentModeState.paymentMode,
    databaseConfigured,
    generatedAt: new Date().toISOString(),
    paymentModeError: paymentModeState.error,
    requiredEvents: [...PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS],
    rows,
    summary: {
      activeDbBindings,
      driftCount,
      envMissingCount,
      inSyncCount,
      notificationDueCount,
    },
  };
}

export async function savePayPalLedgerWebhookBinding({
  actorAdminUserId,
  actorCodexUserId,
  intent,
  key,
  webhookId,
  webhookUrl,
}: SavePayPalLedgerWebhookBindingInput) {
  const definition = PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.find(
    (candidate) => candidate.key === key,
  );

  if (!definition) {
    throw new Error('Unsupported PayPal ledger webhook binding.');
  }

  if (!isPaypalTxLedgerDatabaseConfigured()) {
    throw new Error('PayPal TX Ledger database is not configured.');
  }

  if (intent === 'deactivate') {
    return paypalTxLedger.paypalLedgerTransactionWebhookBinding.update({
      where: { key: definition.key },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        updatedByAdminId: actorAdminUserId,
        updatedByCodexUserId: actorCodexUserId,
      },
    });
  }

  const normalizedWebhookId = webhookId?.trim();

  if (!normalizedWebhookId) {
    throw new Error('Webhook ID is required.');
  }

  const normalizedWebhookUrl = webhookUrl?.trim() || null;
  const expectedUrl = getPayPalLedgerWebhookExpectedUrl(definition);
  const envWebhookId = getPayPalLedgerWebhookEnvValue(definition.envVarName);
  const syncState = getPayPalLedgerWebhookSyncState({
    dbWebhookId: normalizedWebhookId,
    envWebhookId,
  });
  const now = new Date();

  return paypalTxLedger.paypalLedgerTransactionWebhookBinding.upsert({
    where: { key: definition.key },
    create: {
      key: definition.key,
      paypalPaymentMode: definition.paypalPaymentMode,
      deploymentTarget: definition.deploymentTarget,
      envVarName: definition.envVarName,
      label: definition.label,
      webhookId: normalizedWebhookId,
      webhookUrl: normalizedWebhookUrl,
      expectedUrl,
      eventTypes: [...PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS],
      isActive: intent === 'activate',
      lastSyncStatus: syncState.status,
      lastSyncSummary: syncState.label,
      lastObservedEnvWebhookId: envWebhookId,
      lastCheckedAt: now,
      createdByAdminId: actorAdminUserId,
      createdByCodexUserId: actorCodexUserId,
      updatedByAdminId: actorAdminUserId,
      updatedByCodexUserId: actorCodexUserId,
      activatedByAdminId: intent === 'activate' ? actorAdminUserId : null,
      activatedByCodexUserId: intent === 'activate' ? actorCodexUserId : null,
      activatedAt: intent === 'activate' ? now : null,
      deactivatedAt: null,
    },
    update: {
      paypalPaymentMode: definition.paypalPaymentMode,
      deploymentTarget: definition.deploymentTarget,
      envVarName: definition.envVarName,
      label: definition.label,
      webhookId: normalizedWebhookId,
      webhookUrl: normalizedWebhookUrl,
      expectedUrl,
      eventTypes: [...PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS],
      ...(intent === 'activate'
        ? {
            isActive: true,
            activatedByAdminId: actorAdminUserId,
            activatedByCodexUserId: actorCodexUserId,
            activatedAt: now,
            deactivatedAt: null,
          }
        : {}),
      lastSyncStatus: syncState.status,
      lastSyncSummary: syncState.label,
      lastObservedEnvWebhookId: envWebhookId,
      lastCheckedAt: now,
      updatedByAdminId: actorAdminUserId,
      updatedByCodexUserId: actorCodexUserId,
    },
  });
}

export async function registerPayPalLedgerWebhookBinding({
  actorAdminUserId,
  actorCodexUserId,
  key,
  webhookUrl,
}: RegisterPayPalLedgerWebhookBindingInput): Promise<RegisterPayPalLedgerWebhookBindingResult> {
  const definition = PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.find(
    (candidate) => candidate.key === key,
  );

  if (!definition) {
    throw new Error('Unsupported PayPal ledger webhook binding.');
  }

  if (!isPaypalTxLedgerDatabaseConfigured()) {
    throw new Error('PayPal TX Ledger database is not configured.');
  }

  const existingBinding = await paypalTxLedger.paypalLedgerTransactionWebhookBinding.findUnique({
    where: { key: definition.key },
    select: { webhookId: true },
  });
  const envWebhookId = getPayPalLedgerWebhookEnvValue(definition.envVarName);
  const existingWebhookId = existingBinding?.webhookId || envWebhookId;
  const previousWebhookIdSource = existingBinding?.webhookId ? 'db' : envWebhookId ? 'env' : 'none';
  const result = await registerPayPalLedgerWebhook({
    paymentMode: definition.paypalPaymentMode,
    webhookId: existingWebhookId,
    webhookUrl,
  });

  await savePayPalLedgerWebhookBinding({
    actorAdminUserId,
    actorCodexUserId,
    intent: 'activate',
    key: definition.key,
    webhookId: result.webhookId,
    webhookUrl: result.webhookUrl,
  });

  return {
    envVarName: definition.envVarName,
    label: definition.label,
    paypalAction: result.action,
    paypalPaymentMode: definition.paypalPaymentMode,
    previousWebhookIdSource,
    webhookId: result.webhookId,
    webhookUrl: result.webhookUrl,
  };
}

export async function syncPayPalLedgerWebhookEnvToDbBinding({
  actorAdminUserId,
  actorCodexUserId,
  key,
  webhookUrl,
}: SyncPayPalLedgerWebhookEnvToDbInput) {
  const definition = PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.find(
    (candidate) => candidate.key === key,
  );

  if (!definition) {
    throw new Error('Unsupported PayPal ledger webhook binding.');
  }

  if (!isPaypalTxLedgerDatabaseConfigured()) {
    throw new Error('PayPal TX Ledger database is not configured.');
  }

  const envWebhookId = getPayPalLedgerWebhookEnvValue(definition.envVarName);
  if (!envWebhookId) {
    throw new Error(`${definition.envVarName} is not set.`);
  }

  const existingBinding = await paypalTxLedger.paypalLedgerTransactionWebhookBinding.findUnique({
    where: { key: definition.key },
    select: { webhookId: true },
  });

  if (existingBinding?.webhookId) {
    throw new Error('DB binding already has a webhook ID.');
  }

  await savePayPalLedgerWebhookBinding({
    actorAdminUserId,
    actorCodexUserId,
    intent: 'activate',
    key: definition.key,
    webhookId: envWebhookId,
    webhookUrl: webhookUrl?.trim() || getPayPalLedgerWebhookExpectedUrl(definition),
  });

  return {
    envVarName: definition.envVarName,
    label: definition.label,
    webhookId: envWebhookId,
  };
}

async function getPayPalLedgerWebhookDashboardRows({
  databaseConfigured,
}: {
  databaseConfigured: boolean;
}) {
  let dbRows: Awaited<
    ReturnType<typeof paypalTxLedger.paypalLedgerTransactionWebhookBinding.findMany>
  > = [];

  if (databaseConfigured) {
    dbRows = await paypalTxLedger.paypalLedgerTransactionWebhookBinding
      .findMany({
        where: {
          key: {
            in: PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.map((definition) => definition.key),
          },
        },
      })
      .catch((error) => {
        console.error('[paypal.ledger_webhook_dashboard.db_rows_failed]', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });

        return [];
      });
  }

  const dbRowByKey = new Map(dbRows.map((row) => [row.key, row]));
  const currentPaymentMode = getOptionalConfiguredPayPalPaymentMode().paymentMode;

  return PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.map((definition) => {
    const dbRow = dbRowByKey.get(definition.key);
    const envWebhookId = getPayPalLedgerWebhookEnvValue(definition.envVarName);
    const expectedUrl = getPayPalLedgerWebhookExpectedUrl(definition);
    const syncState = getPayPalLedgerWebhookSyncState({
      dbWebhookId: dbRow?.webhookId ?? null,
      envWebhookId,
    });
    const notificationDue =
      Boolean(dbRow?.isActive) &&
      (syncState.status === 'drift' || syncState.status === 'env_missing');

    return {
      activatedAt: dbRow?.activatedAt?.toISOString() ?? null,
      activationRelevant: currentPaymentMode === definition.paypalPaymentMode,
      dbWebhookId: dbRow?.webhookId ?? null,
      deploymentTarget: definition.deploymentTarget,
      envSuggestedLine: `${definition.envVarName}=${dbRow?.webhookId ?? ''}`,
      envVarName: definition.envVarName,
      envWebhookId,
      expectedUrl,
      isActive: Boolean(dbRow?.isActive),
      key: definition.key,
      label: definition.label,
      lastCheckedAt: dbRow?.lastCheckedAt?.toISOString() ?? null,
      lastNotifiedAt: dbRow?.lastNotifiedAt?.toISOString() ?? null,
      lastSyncSummary: dbRow?.lastSyncSummary ?? null,
      notificationDue,
      paypalPaymentMode: definition.paypalPaymentMode,
      syncStatus: syncState.status,
      syncStatusLabel: syncState.label,
      syncTone: syncState.tone,
      updatedAt: dbRow?.updatedAt?.toISOString() ?? null,
      webhookUrl: dbRow?.webhookUrl ?? expectedUrl,
    } satisfies PayPalLedgerWebhookDashboardBinding;
  });
}

async function updatePayPalLedgerWebhookBindingSyncState(
  rows: PayPalLedgerWebhookDashboardBinding[],
) {
  await Promise.all(
    rows
      .filter((row) => row.dbWebhookId)
      .map((row) =>
        paypalTxLedger.paypalLedgerTransactionWebhookBinding.update({
          where: { key: row.key },
          data: {
            lastSyncStatus: row.syncStatus,
            lastSyncSummary: row.syncStatusLabel,
            lastObservedEnvWebhookId: row.envWebhookId,
            lastCheckedAt: new Date(),
          },
        }),
      ),
  );
}

async function notifyPayPalLedgerWebhookDrift({
  activationSource,
  rows,
}: {
  activationSource: PayPalLedgerWebhookActivationSource;
  rows: PayPalLedgerWebhookDashboardBinding[];
}) {
  const dedupePrefixesToSend: string[] = [];

  for (const row of rows) {
    if (!row.notificationDue || !row.dbWebhookId) continue;

    const result = await enqueueAdminPayPalLedgerWebhookDriftNotification({
      activationSource,
      dbWebhookId: row.dbWebhookId,
      envVarName: row.envVarName,
      envWebhookId: row.envWebhookId,
      label: row.label,
      message: `${row.envVarName} does not match the active DB binding for ${row.label}.`,
      severity: row.syncStatus === 'env_missing' ? 'critical' : 'warning',
      syncStatus: row.syncStatus,
    });

    if (!result.skipped) {
      if (result.dedupeBase) {
        dedupePrefixesToSend.push(result.dedupeBase);
      }

      await paypalTxLedger.paypalLedgerTransactionWebhookBinding.update({
        where: { key: row.key },
        data: {
          lastNotificationDedupeKey: result.dedupeBase,
          lastNotifiedAt: result.created ? new Date() : undefined,
        },
      });
    }
  }

  for (const dedupePrefix of dedupePrefixesToSend) {
    await sendPendingAdminNotificationsByDedupePrefix({ dedupePrefix, limit: 10 }).catch(
      (error) => {
        console.error('[paypal.ledger_webhook_notifications.send_failed]', {
          dedupePrefix,
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      },
    );
  }
}

function getPayPalLedgerWebhookSyncState({
  dbWebhookId,
  envWebhookId,
}: {
  dbWebhookId?: string | null;
  envWebhookId?: string | null;
}) {
  if (dbWebhookId && envWebhookId && dbWebhookId === envWebhookId) {
    return {
      label: 'DB and env match',
      status: 'in_sync' as const,
      tone: 'emerald' as const,
    };
  }

  if (dbWebhookId && envWebhookId && dbWebhookId !== envWebhookId) {
    return {
      label: 'DB and env differ',
      status: 'drift' as const,
      tone: 'amber' as const,
    };
  }

  if (dbWebhookId && !envWebhookId) {
    return {
      label: 'Env value missing',
      status: 'env_missing' as const,
      tone: 'rose' as const,
    };
  }

  if (!dbWebhookId && envWebhookId) {
    return {
      label: 'DB binding missing',
      status: 'db_missing' as const,
      tone: 'amber' as const,
    };
  }

  return {
    label: 'No DB or env value',
    status: 'missing_both' as const,
    tone: 'slate' as const,
  };
}
