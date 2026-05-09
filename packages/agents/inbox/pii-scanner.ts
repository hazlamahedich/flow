import { tokenizePII } from '../shared/pii-tokenizer';

const PII_SIGNAL_FIELDS = [
  'subject',
  'reasoning',
  'from_address',
  'actionTaken',
  'reason',
  'description',
] as const;

export interface PIIScanResult {
  hasPII: boolean;
  findings: Array<{ field: string; types: string[] }>;
  sanitizedPayload: Record<string, unknown>;
}

export function scanSignalForPII(
  payload: Record<string, unknown>,
  workspaceId: string,
): PIIScanResult {
  const findings: PIIScanResult['findings'] = [];
  const sanitizedPayload = { ...payload };

  for (const field of PII_SIGNAL_FIELDS) {
    const value = payload[field];
    if (typeof value !== 'string') continue;

    const result = tokenizePII(value, workspaceId);
    if (result.tokens.length > 0) {
      findings.push({
        field,
        types: [...new Set(result.tokens.map((t) => t.type))],
      });
      sanitizedPayload[field] = result.text;
    }
  }

  return {
    hasPII: findings.length > 0,
    findings,
    sanitizedPayload,
  };
}
