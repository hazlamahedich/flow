import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';

export function renderSmoke(children?: ReactNode): RenderResult {
  const ui = children ?? <div data-testid="smoke" />;
  const result = render(ui);
  if (!children) {
    const smoke = result.getByTestId('smoke');
    if (!smoke) {
      throw new Error('renderSmoke: default smoke element not found');
    }
  }
  return result;
}
