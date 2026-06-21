'use server';

import { revalidatePath } from 'next/cache';
import { writeAdminAuditLog } from '@/lib/admin/admin-auth-ledger';
import { requireAdminAction } from '@/lib/admin/require-admin';
import {
  runPayPalPaymentReconciliationScanner,
  type PayPalPaymentReconciliationRunResult,
} from '@/lib/paypal/txLedger/paymentReconciliation';

export type PayPalPaymentReconciliationActionState = {
  error: string | null;
  success: string | null;
  result: PayPalPaymentReconciliationRunResult | null;
};

export async function runPayPalPaymentReconciliationAction(
  _prevState: PayPalPaymentReconciliationActionState,
  formData: FormData,
): Promise<PayPalPaymentReconciliationActionState> {
  const dryRun = formData.get('dryRun') === 'true';
  let actor: Awaited<ReturnType<typeof requireAdminAction>> | null = null;

  try {
    actor = await requireAdminAction('shop.recovery.run');
    const result = await runPayPalPaymentReconciliationScanner({ dryRun });
    const completedCount = result.results.filter((row) => row.ok).length;
    const failedCount = result.results.length - completedCount;

    await writeAdminAuditLog({
      actor,
      action: 'shop.paypal_payment_reconciliation.scan',
      targetType: 'paypalTxLedger',
      outcome: result.ok ? 'success' : 'failure',
      metadata: {
        dryRun,
        candidateCount: result.candidates.length,
        resultCount: result.results.length,
        completedCount,
        failedCount,
        skippedCount: result.skipped.length,
      },
    });

    revalidatePath('/admin/shop/paypal-reconciliation');
    revalidatePath('/admin/shop');

    if (!result.enabled) {
      return {
        error: null,
        success: 'Payment reconciliation scanner is disabled.',
        result,
      };
    }

    return {
      error: null,
      success: dryRun
        ? `Dry run found ${result.candidates.length} payment attention row${result.candidates.length === 1 ? '' : 's'}.`
        : `Reconciled ${completedCount} row${completedCount === 1 ? '' : 's'}; ${failedCount} still need attention.`,
      result,
    };
  } catch (error) {
    if (actor) {
      await writeAdminAuditLog({
        actor,
        action: 'shop.paypal_payment_reconciliation.scan',
        targetType: 'paypalTxLedger',
        outcome: 'failure',
        metadata: {
          dryRun,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
    }

    return {
      error: error instanceof Error ? error.message : 'Unable to run payment reconciliation.',
      success: null,
      result: null,
    };
  }
}
