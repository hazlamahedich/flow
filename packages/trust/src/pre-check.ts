export interface PreconditionEntry {
  condition_key: string;
  condition_expr: string;
  is_active: boolean;
}

interface PreconditionCheckResult {
  passed: boolean;
  failedKey: string | undefined;
}

export function evaluatePreconditions(
  preconditions: PreconditionEntry[],
  executionContext: Record<string, unknown> | null,
): PreconditionCheckResult {
  if (!preconditions.length) {
    return { passed: true, failedKey: undefined };
  }

  if (!executionContext) {
    return { passed: true, failedKey: undefined };
  }

  for (const precondition of preconditions) {
    if (!precondition.is_active) continue;

    const value = executionContext[precondition.condition_key];
    const expected = precondition.condition_expr;

    if (value === undefined || value === null) {
      return { passed: false, failedKey: precondition.condition_key };
    }

    const stringValue = String(value);
    if (stringValue !== expected) {
      return { passed: false, failedKey: precondition.condition_key };
    }
  }

  return { passed: true, failedKey: undefined };
}
