import 'server-only';

import { createHash } from 'crypto';
import {
  getOptionalConfiguredPayPalPaymentMode,
  getPayPalLedgerWebhookActivationSource,
  getPayPalLedgerWebhookEnvValue,
  getPayPalLedgerWebhookExpectedUrl,
  getPayPalWebhookProcessingOwner,
  PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS,
  PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS,
  type PayPalWebhookProcessingOwnership,
  type PayPalLedgerWebhookActivationSource,
  type PayPalLedgerWebhookBindingKey,
} from '@/lib/paypal/ledgerWebhookConfig';
import { registerPayPalLedgerWebhook } from '@/lib/paypal/payPalWebhookRegistry';
import {
  getPaypalTxLedgerDatabaseStatus,
  isPaypalTxLedgerDatabaseConfigured,
  paypalTxLedger,
  type PaypalTxLedgerDatabaseStatus,
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
  isProcessingOwner: boolean;
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
  databaseTarget: PayPalLedgerWebhookDatabaseTargetStatus;
  generatedAt: string;
  paypalApp: PayPalLedgerWebhookPayPalAppStatus;
  paymentModeError: string | null;
  processingOwnership: PayPalLedgerWebhookProcessingOwnerStatus | null;
  requiredEvents: string[];
  rows: PayPalLedgerWebhookDashboardBinding[];
  safetyWarnings: PayPalLedgerWebhookSafetyWarning[];
  summary: {
    activeDbBindings: number;
    driftCount: number;
    envMissingCount: number;
    inSyncCount: number;
    notificationDueCount: number;
    safetyWarningCount: number;
  };
};

export type PayPalLedgerWebhookProcessingOwnerStatus = PayPalWebhookProcessingOwnership & {
  ownerLabel: string;
  ownerTrustedByRuntime: boolean;
};

export type PayPalLedgerWebhookPayPalAppStatus = {
  currentClientIdConfigured: boolean;
  currentClientIdFingerprint: string | null;
  liveClientIdFingerprint: string | null;
  sandboxClientIdFingerprint: string | null;
};

export type PayPalLedgerWebhookSafetyWarning = {
  code: string;
  message: string;
  severity: 'critical' | 'warning';
};

export type PayPalLedgerWebhookDatabaseTargetWarning = {
  code:
    | 'dev_runtime_using_prod_branch'
    | 'invalid_branch_env'
    | 'missing_ledger_database'
    | 'prod_dev_urls_match'
    | 'production_using_dev_branch';
  message: string;
  severity: 'critical' | 'warning';
};

export type PayPalLedgerWebhookDatabaseTargetStatus = PaypalTxLedgerDatabaseStatus & {
  label: string;
  tone: 'amber' | 'emerald' | 'rose';
  warnings: PayPalLedgerWebhookDatabaseTargetWarning[];
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
  const databaseTarget = getPayPalLedgerWebhookDatabaseTargetStatus();
  const databaseConfigured = databaseTarget.configured;
  const rawProcessingOwnership = paymentModeState.paymentMode
    ? getPayPalWebhookProcessingOwner(paymentModeState.paymentMode)
    : null;
  const rows = await getPayPalLedgerWebhookDashboardRows({
    databaseConfigured,
    processingOwner: rawProcessingOwnership?.owner ?? null,
  });
  const processingOwnership = rawProcessingOwnership
    ? getPayPalLedgerWebhookProcessingOwnerStatus({
        activationSource,
        ownership: rawProcessingOwnership,
        rows,
      })
    : null;
  const paypalApp = getPayPalLedgerWebhookPayPalAppStatus(paymentModeState.paymentMode);
  const safetyWarnings = getPayPalLedgerWebhookSafetyWarnings({
    activationSource,
    currentPaymentMode: paymentModeState.paymentMode,
    databaseTarget,
    processingOwnership,
    rows,
  });

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
    databaseTarget,
    generatedAt: new Date().toISOString(),
    paypalApp,
    paymentModeError: paymentModeState.error,
    processingOwnership,
    requiredEvents: [...PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS],
    rows,
    safetyWarnings,
    summary: {
      activeDbBindings,
      driftCount,
      envMissingCount,
      inSyncCount,
      notificationDueCount,
      safetyWarningCount: safetyWarnings.length,
    },
  };
}

function fingerprintRuntimeValue(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) return null;

  return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

function getPayPalLedgerWebhookPayPalAppStatus(
  currentPaymentMode: 'sandbox' | 'live' | null,
): PayPalLedgerWebhookPayPalAppStatus {
  const sandboxClientIdFingerprint = fingerprintRuntimeValue(process.env.PAYPAL_SANDBOX_CLIENT_ID);
  const liveClientIdFingerprint = fingerprintRuntimeValue(process.env.PAYPAL_LIVE_CLIENT_ID);
  const currentClientIdFingerprint =
    currentPaymentMode === 'live' ? liveClientIdFingerprint : sandboxClientIdFingerprint;

  return {
    currentClientIdConfigured: Boolean(currentClientIdFingerprint),
    currentClientIdFingerprint,
    liveClientIdFingerprint,
    sandboxClientIdFingerprint,
  };
}

function getPayPalLedgerWebhookBindingLabel(key: string | null) {
  if (!key || key === 'none') return 'None';

  return (
    PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.find((definition) => definition.key === key)?.label ??
    key.replaceAll('_', ' ')
  );
}

function isPayPalLedgerWebhookBindingTrustedByRuntime({
  activationSource,
  row,
}: {
  activationSource: PayPalLedgerWebhookActivationSource;
  row: PayPalLedgerWebhookDashboardBinding | undefined;
}) {
  return (
    Boolean(row?.envWebhookId) ||
    (activationSource === 'db_hybrid' && Boolean(row?.isActive && row.dbWebhookId))
  );
}

function getPayPalLedgerWebhookProcessingOwnerStatus({
  activationSource,
  ownership,
  rows,
}: {
  activationSource: PayPalLedgerWebhookActivationSource;
  ownership: PayPalWebhookProcessingOwnership;
  rows: PayPalLedgerWebhookDashboardBinding[];
}): PayPalLedgerWebhookProcessingOwnerStatus {
  const ownerRow = rows.find((row) => row.key === ownership.owner);

  return {
    ...ownership,
    ownerLabel: getPayPalLedgerWebhookBindingLabel(ownership.owner),
    ownerTrustedByRuntime: isPayPalLedgerWebhookBindingTrustedByRuntime({
      activationSource,
      row: ownerRow,
    }),
  };
}

function getPayPalLedgerWebhookSafetyWarnings({
  activationSource,
  currentPaymentMode,
  databaseTarget,
  processingOwnership,
  rows,
}: {
  activationSource: PayPalLedgerWebhookActivationSource;
  currentPaymentMode: 'sandbox' | 'live' | null;
  databaseTarget: PayPalLedgerWebhookDatabaseTargetStatus;
  processingOwnership: PayPalLedgerWebhookProcessingOwnerStatus | null;
  rows: PayPalLedgerWebhookDashboardBinding[];
}): PayPalLedgerWebhookSafetyWarning[] {
  const warnings: PayPalLedgerWebhookSafetyWarning[] = [...databaseTarget.warnings];

  if (!currentPaymentMode || !processingOwnership) return warnings;

  if (processingOwnership.error) {
    warnings.push({
      code: 'paypal_webhook_processing_owner_invalid',
      message: processingOwnership.error,
      severity: 'critical',
    });
  }

  if (processingOwnership.owner === 'none') {
    warnings.push({
      code: 'paypal_webhook_processing_owner_none',
      message:
        'PayPal webhook processing owner is set to none. This runtime will acknowledge matching webhooks without mutating the ledger.',
      severity: currentPaymentMode === 'live' ? 'critical' : 'warning',
    });
  }

  if (processingOwnership.owner !== 'none') {
    const ownerRow = rows.find((row) => row.key === processingOwnership.owner);

    if (
      !isPayPalLedgerWebhookBindingTrustedByRuntime({
        activationSource,
        row: ownerRow,
      })
    ) {
      warnings.push({
        code: 'paypal_webhook_processing_owner_untrusted',
        message: `${processingOwnership.ownerLabel} owns processing for this runtime, but no trusted webhook ID for that binding is currently available through env or active DB binding.`,
        severity: 'critical',
      });
    }
  }

  return warnings;
}

function getPayPalLedgerWebhookDatabaseTargetStatus(): PayPalLedgerWebhookDatabaseTargetStatus {
  const status = getPaypalTxLedgerDatabaseStatus();
  const warnings: PayPalLedgerWebhookDatabaseTargetWarning[] = [];

  if (!status.configured) {
    warnings.push({
      code: 'missing_ledger_database',
      message: 'No PayPal TX ledger database URL is configured.',
      severity: 'critical',
    });
  }

  if (status.invalidExplicitBranchConfigured) {
    warnings.push({
      code: 'invalid_branch_env',
      message: 'PAYPAL_TX_LEDGER_NEON_BRANCH is set but is not "prod" or "dev".',
      severity: 'warning',
    });
  }

  if (status.nodeEnv === 'production' && status.selectedBranch === 'dev') {
    warnings.push({
      code: 'production_using_dev_branch',
      message:
        'Production runtime is using the dev PayPal TX ledger branch. Production webhooks can process local/dev test rows.',
      severity: 'critical',
    });
  }

  if (status.nodeEnv !== 'production' && status.selectedBranch === 'prod') {
    warnings.push({
      code: 'dev_runtime_using_prod_branch',
      message:
        'Non-production runtime is using the prod PayPal TX ledger branch. Local testing can touch production ledger rows.',
      severity: 'warning',
    });
  }

  if (status.prodDevUrlsMatch) {
    warnings.push({
      code: 'prod_dev_urls_match',
      message:
        'Prod and dev PayPal TX ledger URLs appear identical. Separate webhook tests may still hit the same ledger rows.',
      severity: 'critical',
    });
  }

  const hasCriticalWarning = warnings.some((warning) => warning.severity === 'critical');
  const label = status.selectedBranch
    ? `${status.selectedBranch} branch`
    : status.configured
      ? 'configured'
      : 'missing';

  return {
    ...status,
    label,
    tone: hasCriticalWarning ? 'rose' : warnings.length ? 'amber' : 'emerald',
    warnings,
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
  processingOwner,
}: {
  databaseConfigured: boolean;
  processingOwner: string | null;
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
      isProcessingOwner: definition.key === processingOwner,
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
