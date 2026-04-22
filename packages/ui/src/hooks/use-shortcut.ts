import { useEffect, useRef } from 'react';
import type { ShortcutDefinition, ShortcutRegistry } from '@flow/shared';
import { isInputFocused, hasModifierKey, isImeComposing } from '@flow/shared';

export function useShortcut(
  registry: ShortcutRegistry | null,
  shortcut: ShortcutDefinition | null,
  options?: { enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;
  const idRef = useRef<string | null>(null);
  const shortcutRef = useRef(shortcut);
  shortcutRef.current = shortcut;

  useEffect(() => {
    if (!registry || !shortcutRef.current || !enabled) {
      if (idRef.current && registry) {
        registry.unregister(idRef.current);
        idRef.current = null;
      }
      return;
    }

    const wrappedAction = (event: KeyboardEvent) => {
      if (isInputFocused(event.target) && !hasModifierKey(event)) return;
      if (isImeComposing(event)) return;

      try {
        shortcutRef.current!.action(event);
      } catch (error) {
        console.error('[useShortcut] Handler error:', error);
      }
    };

    const definition: ShortcutDefinition = {
      ...shortcutRef.current,
      action: wrappedAction,
    };

    idRef.current = registry.register(definition);

    return () => {
      if (idRef.current) {
        registry.unregister(idRef.current);
        idRef.current = null;
      }
    };
  }, [registry, enabled]);
}
