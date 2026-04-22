import { describe, it, expect } from 'vitest';
import { isBlockNoteFocused } from './blocknote-guard';

describe('blocknote-guard', () => {
  it('returns false for null element', () => {
    expect(isBlockNoteFocused(null)).toBe(false);
  });

  it('returns false for regular element', () => {
    const div = document.createElement('div');
    expect(isBlockNoteFocused(div)).toBe(false);
  });

  it('returns true when inside BlockNote editor', () => {
    const editor = document.createElement('div');
    editor.setAttribute('data-blocknote-editor', '');
    const child = document.createElement('span');
    editor.appendChild(child);
    document.body.appendChild(editor);
    expect(isBlockNoteFocused(child)).toBe(true);
    document.body.removeChild(editor);
  });

  it('returns false for contenteditable outside BlockNote', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    expect(isBlockNoteFocused(el)).toBe(false);
  });
});
