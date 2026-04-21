import type { FlowError } from './errors';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: FlowError };
