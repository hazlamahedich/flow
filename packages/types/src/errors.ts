import type { AgentId } from './agents';

export type { AgentId };

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
  | 'FINANCIAL_AMOUNT_MISMATCH'
  | 'FINANCIAL_INVALID_STATE'
  | 'FINANCIAL_CURRENCY_MISMATCH'
  | 'SYSTEM_CONFIG_MISSING'
  | 'SYSTEM_DEPENDENCY_FAILURE'
  | 'SYSTEM_RATE_LIMITED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'WORKSPACE_SLUG_COLLISION'
  | 'INVITATION_NOT_FOUND'
  | 'INVITATION_EXPIRED'
  | 'INVITATION_ALREADY_ACCEPTED'
  | 'MEMBER_ALREADY_EXISTS'
  | 'TRANSFER_NOT_FOUND'
  | 'TRANSFER_EXPIRED'
  | 'TRANSFER_ALREADY_PENDING'
  | 'EMAIL_CHANGE_PENDING'
  | 'EMAIL_UNAVAILABLE'
  | 'EMAIL_CHANGE_RATE_LIMITED'
  | 'EMAIL_CHANGE_ALREADY_APPLIED';

export type AgentErrorCode =
  | 'AGENT_ERROR'
  | 'AGENT_TIMEOUT'
  | 'AGENT_PRECHECK_FAILED'
  | 'AGENT_OUTPUT_REJECTED';

export type FlowErrorCategory = 'auth' | 'validation' | 'agent' | 'financial' | 'system';

export interface FlowErrorBase {
  status: number;
  code: FlowErrorCode;
  message: string;
  category: FlowErrorCategory;
  details?: Record<string, unknown>;
}

export type FlowError =
  | FlowErrorBase
  | { status: number; code: 'AGENT_ERROR'; message: string; category: 'agent'; agentType: AgentId; retryable: boolean; details?: Record<string, unknown> }
  | { status: number; code: 'AGENT_TIMEOUT'; message: string; category: 'agent'; agentType: AgentId; details?: Record<string, unknown> }
  | { status: number; code: 'AGENT_PRECHECK_FAILED'; message: string; category: 'agent'; agentType: AgentId; details?: Record<string, unknown> }
  | { status: number; code: 'AGENT_OUTPUT_REJECTED'; message: string; category: 'agent'; agentType: AgentId; details?: Record<string, unknown> };
