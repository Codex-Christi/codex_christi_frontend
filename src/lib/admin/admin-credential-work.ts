import 'server-only';

export class AdminCredentialError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Share the same two slots across Next's route and action bundles.
const budgetKey = Symbol.for('codexchristi.admin-credential-budget.v1');
const shared = globalThis as typeof globalThis & { [budgetKey]?: { active: number } };
const budget = (shared[budgetKey] ??= { active: 0 });

export async function withAdminCredentialWork<T>(run: () => Promise<T>): Promise<T> {
  if (budget.active >= 2)
    throw new AdminCredentialError('Admin access is busy. Please try again shortly.', 429);
  budget.active++;
  try {
    return await run();
  } finally {
    budget.active--;
  }
}
