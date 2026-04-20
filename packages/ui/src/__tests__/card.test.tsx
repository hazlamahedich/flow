import { describe, it, expect } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { screen } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '../components/card/card';

describe('Card', () => {
  it('renders with surface and elevation tokens', () => {
    renderWithTheme(
      <Card data-testid="card">
        <CardHeader>Header</CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-[var(--flow-bg-surface)]');
    expect(card.className).toContain('shadow-[var(--flow-shadow-sm)]');
  });

  it('renders children', () => {
    renderWithTheme(
      <Card>
        <CardHeader>Title</CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });
});
