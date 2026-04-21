export type FlowErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'AUTH_INVALID_TOKEN'
  | 'RATE_LIMITED'
  | 'PKCE_FAILED'
  | 'WORKSPACE_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'TENANT_CONTEXT_MISSING'
  | 'TENANT_ACCESS_DENIED'
  | 'SESSION_EXPIRED'
  | 'INSUFFICIENT_ROLE'
  | 'TENANT_MISMATCH'
  | 'VALIDATION_ERROR'
  | 'VALIDATION_SCHEMA_MISMATCH'
  | 'AGENT_NOT_FOUND'
  | 'AGENT_DISABLED'
  | 'AGENT_TIMEOUT'
  | 'AGENT_PRECHECK_FAILED'
  | 'AGENT_OUTPUT_REJECTED'
  | 'FINANCIAL_AMOUNT_MISMATCH'
  | 'FINANCIAL_INVALID_STATE'
  | 'FINANCIAL_CURRENCY_MISMATCH'
  | 'SYSTEM_CONFIG_MISSING'
  | 'SYSTEM_DEPENDENCY_FAILURE'
  | 'SYSTEM_RATE_LIMITED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type FlowErrorCategory = 'auth' | 'validation' | 'agent' | 'financial' | 'system';

interface FlowErrorBase {
  status: number;
  code: FlowErrorCode;
  message: string;
  category: FlowErrorCategory;
  details?: Record<string, unknown>;
}

export type FlowError = FlowErrorBase;
