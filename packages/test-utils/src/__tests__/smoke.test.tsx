import { describe, it, expect } from 'vitest';
import { renderSmoke } from '../render-smoke';

describe('renderSmoke', () => {
  it('renders default smoke element', () => {
    const { getByTestId } = renderSmoke();
    expect(getByTestId('smoke')).toBeDefined();
  });

  it('renders provided children', () => {
    const { getByText } = renderSmoke(<span>hello</span>);
    expect(getByText('hello')).toBeDefined();
  });
});
