export { sidebarCollapsedAtom, sidebarHoverExpandedAtom } from './atoms/ui-state';
export { commandPaletteOpenAtom, shortcutOverlayOpenAtom } from './atoms/ui-state';
export { createShortcutRegistry, safeHandler } from './shortcuts/registry';
export { isInputFocused, hasModifierKey, isImeComposing } from './shortcuts/input-guard';
export { isBlockNoteFocused } from './shortcuts/blocknote-guard';
export { OverlayPriority } from './shortcuts/overlay-priority';
export { getDefaultShortcuts, isMac, isWindows } from './shortcuts/defaults';
export type {
  ShortcutDefinition,
  ShortcutContext,
  ShortcutHandler,
  ShortcutRegistry,
  RegisteredShortcut,
  ShortcutGuard,
} from './shortcuts/types';

export type {
  UndoEntry,
  UndoStack,
  UndoActionType,
  UndoActionSeverity,
} from './undo/types';
export {
  UNDO_MAX_ENTRIES,
  UNDO_WINDOW_MS,
  UNDO_MAX_SNAPSHOT_BYTES,
} from './undo/types';
export { UNDO_WORKSPACE_CONTEXT_KEY } from './undo/undo-context';
export {
  undoStacksAtom,
  createUndoStackActions,
  createEmptyStack,
  pruneExpired,
  measureSnapshot,
} from './undo/undo-stack';

export {
  ALLOWED_TRANSITIONS,
  isValidTransition,
  assertTransition,
  AgentTransitionError as SharedAgentTransitionError,
} from './agent-transitions';
export { deriveUIStatus } from './derive-agent-ui-status';
export { type CircuitBreakerPort, NOOP_CIRCUIT_BREAKER } from './resilience/types';

export {
  AGENT_IDENTITY,
  AGENT_IDS,
  AGENT_CADENCE,
  TRUST_LEVEL_COLORS,
} from './constants/agent-identity';
export type {
  AgentIdentity,
  CadenceTier,
  TrustLevelColorSet,
} from './constants/agent-identity';
