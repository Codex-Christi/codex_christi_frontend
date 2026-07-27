export type ShopOpsDataTarget = 'dev' | 'prod';

export type ShopOpsDataTargetSource = 'canonical' | 'legacy_aligned' | 'unconfigured';

export type ShopOpsDataTargetStatus = {
  aligned: boolean;
  canonicalTarget: ShopOpsDataTarget | null;
  configurationError: string | null;
  configured: boolean;
  isLocalProductionTarget: boolean;
  localProductionMutationsEnabled: boolean;
  merchizeFulfillmentOpsTargetUrlConfigured: boolean;
  merchizeFulfillmentOpsLegacyTarget: ShopOpsDataTarget | null;
  nodeEnv: string;
  paypalLegacyTarget: ShopOpsDataTarget | null;
  paypalTargetUrlConfigured: boolean;
  source: ShopOpsDataTargetSource;
  target: ShopOpsDataTarget | null;
};

export type ShopOpsDataTargetView = Pick<
  ShopOpsDataTargetStatus,
  | 'aligned'
  | 'configurationError'
  | 'configured'
  | 'isLocalProductionTarget'
  | 'localProductionMutationsEnabled'
  | 'nodeEnv'
  | 'source'
  | 'target'
>;

export type ShopOpsConfigurationErrorCode =
  | 'SHOP_OPS_DATA_TARGET_INVALID'
  | 'SHOP_OPS_DATA_TARGET_MISMATCH'
  | 'SHOP_OPS_DATA_TARGET_UNCONFIGURED'
  | 'SHOP_OPS_LOCAL_PRODUCTION_MUTATIONS_DISABLED'
  | 'SHOP_OPS_LOCAL_PRODUCTION_MASTER_CONFIRMATION_REQUIRED';

type ShopOpsEnvironment = Record<string, string | undefined>;

export class ShopOpsConfigurationError extends Error {
  readonly code: ShopOpsConfigurationErrorCode;

  constructor(code: ShopOpsConfigurationErrorCode, message: string) {
    super(message);
    this.name = 'ShopOpsConfigurationError';
    this.code = code;
  }
}

export function normalizeShopOpsDataTarget(value: string | undefined): ShopOpsDataTarget | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'dev' || normalized === 'prod' ? normalized : null;
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function firstNonBlank(...values: Array<string | undefined>) {
  return values.find(hasValue);
}

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

export function resolveShopOpsDataTarget(
  env: ShopOpsEnvironment = process.env,
): ShopOpsDataTargetStatus {
  const canonicalTarget = normalizeShopOpsDataTarget(env.SHOP_OPS_DATA_TARGET);
  const paypalLegacyTarget = normalizeShopOpsDataTarget(env.PAYPAL_TX_LEDGER_NEON_BRANCH);
  const merchizeFulfillmentOpsLegacyTarget = normalizeShopOpsDataTarget(
    env.MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH,
  );
  const invalidCanonicalTarget = hasValue(env.SHOP_OPS_DATA_TARGET) && !canonicalTarget;
  const invalidPaypalTarget = hasValue(env.PAYPAL_TX_LEDGER_NEON_BRANCH) && !paypalLegacyTarget;
  const invalidMerchizeTarget =
    hasValue(env.MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH) && !merchizeFulfillmentOpsLegacyTarget;

  let target: ShopOpsDataTarget | null = canonicalTarget;
  let source: ShopOpsDataTargetSource = canonicalTarget ? 'canonical' : 'unconfigured';
  let configurationError: string | null = null;

  if (invalidCanonicalTarget) {
    configurationError = 'SHOP_OPS_DATA_TARGET must use exactly "dev" or "prod".';
  } else if (canonicalTarget) {
    // The canonical runtime target intentionally overrides legacy selectors.
  } else if (invalidPaypalTarget || invalidMerchizeTarget) {
    configurationError = 'Legacy Shop Ops branch selectors must use exactly "dev" or "prod".';
  } else if (
    paypalLegacyTarget &&
    merchizeFulfillmentOpsLegacyTarget &&
    paypalLegacyTarget === merchizeFulfillmentOpsLegacyTarget
  ) {
    target = paypalLegacyTarget;
    source = 'legacy_aligned';
  } else if (paypalLegacyTarget || merchizeFulfillmentOpsLegacyTarget) {
    configurationError =
      'PayPal TX Ledger and Merchize Fulfillment Ops branch selectors must both be present and equal.';
  } else {
    configurationError = 'SHOP_OPS_DATA_TARGET is not configured.';
  }

  const paypalTargetUrlConfigured =
    target === 'prod'
      ? hasValue(env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING)
      : target === 'dev'
        ? hasValue(env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING)
        : false;
  const merchizeFulfillmentOpsTargetUrlConfigured =
    target === 'prod'
      ? hasValue(
          firstNonBlank(
            env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING,
            env.MERCHIZE_FULFILLMENT_OPS_DATABASE_URL,
          ),
        )
      : target === 'dev'
        ? hasValue(
            firstNonBlank(
              env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING,
              env.MERCHIZE_FULFILLMENT_OPS_DATABASE_DEV_URL,
            ),
          )
        : false;
  if (target && !configurationError) {
    const missingTargets = [
      !paypalTargetUrlConfigured ? 'PayPal TX Ledger' : null,
      !merchizeFulfillmentOpsTargetUrlConfigured ? 'Merchize Fulfillment Ops' : null,
    ].filter(Boolean);
    if (missingTargets.length > 0) {
      configurationError = `The ${target} Shop Ops target is missing a pooled URL for ${missingTargets.join(' and ')}.`;
    }
  }

  const nodeEnv = env.NODE_ENV?.trim() || 'unknown';
  const aligned = Boolean(target && !configurationError);

  return {
    aligned,
    canonicalTarget,
    configurationError,
    configured: Boolean(
      target && paypalTargetUrlConfigured && merchizeFulfillmentOpsTargetUrlConfigured,
    ),
    isLocalProductionTarget: target === 'prod' && nodeEnv !== 'production',
    localProductionMutationsEnabled: isEnabled(env.SHOP_OPS_ALLOW_LOCAL_PRODUCTION_MUTATIONS),
    merchizeFulfillmentOpsTargetUrlConfigured,
    merchizeFulfillmentOpsLegacyTarget,
    nodeEnv,
    paypalLegacyTarget,
    paypalTargetUrlConfigured,
    source,
    target,
  };
}

export function getShopOpsDataTargetStatus() {
  return resolveShopOpsDataTarget();
}

export function getShopOpsDataTargetView(): ShopOpsDataTargetView {
  const status = getShopOpsDataTargetStatus();
  return {
    aligned: status.aligned,
    configurationError: status.configurationError,
    configured: status.configured,
    isLocalProductionTarget: status.isLocalProductionTarget,
    localProductionMutationsEnabled: status.localProductionMutationsEnabled,
    nodeEnv: status.nodeEnv,
    source: status.source,
    target: status.target,
  };
}

export function assertAlignedShopOpsDataTarget() {
  const status = getShopOpsDataTargetStatus();

  if (!status.target) {
    throw new ShopOpsConfigurationError(
      'SHOP_OPS_DATA_TARGET_UNCONFIGURED',
      status.configurationError ?? 'Shop Ops data target is not configured.',
    );
  }

  if (!status.aligned) {
    throw new ShopOpsConfigurationError(
      status.configurationError?.includes('conflict') ||
        status.configurationError?.includes('equal')
        ? 'SHOP_OPS_DATA_TARGET_MISMATCH'
        : 'SHOP_OPS_DATA_TARGET_INVALID',
      status.configurationError ?? 'Shop Ops data target configuration is invalid.',
    );
  }

  return status;
}

export function assertShopOpsMutationAllowed({
  localProductionMasterConfirmed = false,
}: {
  localProductionMasterConfirmed?: boolean;
} = {}) {
  const status = assertAlignedShopOpsDataTarget();

  if (!status.isLocalProductionTarget) return status;

  if (!status.localProductionMutationsEnabled) {
    throw new ShopOpsConfigurationError(
      'SHOP_OPS_LOCAL_PRODUCTION_MUTATIONS_DISABLED',
      'This localhost process is connected to production Shop Ops data, but local production mutations are disabled. Set SHOP_OPS_ALLOW_LOCAL_PRODUCTION_MUTATIONS=true and restart only for an intentional, supervised recovery session.',
    );
  }

  if (!localProductionMasterConfirmed) {
    throw new ShopOpsConfigurationError(
      'SHOP_OPS_LOCAL_PRODUCTION_MASTER_CONFIRMATION_REQUIRED',
      'A master-admin password confirmation is required before localhost can mutate production Shop Ops data.',
    );
  }

  return status;
}

export function getShopOpsAuditMetadata(status: ShopOpsDataTargetStatus) {
  return {
    dataTarget: status.target,
    dataTargetSource: status.source,
    localProductionTarget: status.isLocalProductionTarget,
    runtimeEnvironment: status.nodeEnv,
  };
}
