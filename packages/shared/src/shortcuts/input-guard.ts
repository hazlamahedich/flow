const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
]);

export function isInputFocused(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  const tag = element.tagName;

  if (tag === 'TEXTAREA') return true;

  if (tag === 'INPUT') {
    const input = element as HTMLInputElement;
    return TEXT_INPUT_TYPES.has(input.type);
  }

  if (element.isContentEditable) return true;

  const contentEditable = element.getAttribute('contenteditable');
  if (contentEditable === 'true' || contentEditable === '') return true;

  return false;
}

export function hasModifierKey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

export function isImeComposing(event: KeyboardEvent): boolean {
  return event.isComposing === true;
}
