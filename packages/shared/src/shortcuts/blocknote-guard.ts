export function isBlockNoteFocused(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  const editor = element.closest('[data-blocknote-editor]');
  return editor !== null;
}
