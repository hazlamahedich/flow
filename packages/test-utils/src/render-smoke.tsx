import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';

export function renderSmoke(children?: ReactNode): RenderResult {
  const ui = children ?? <div data-testid="smoke" />;
  return render(ui);
}
