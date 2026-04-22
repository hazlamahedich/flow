import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithTheme } from '@flow/test-utils';
import { EmptyStateCard } from './empty-state-card';
import { Inbox } from 'lucide-react';

beforeEach(() => {
  document.documentElement.removeAttribute('data-flow-theme-provider');
  document.documentElement.removeAttribute('data-theme');
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('EmptyStateCard', () => {
  it('renders icon, title, and description', () => {
    const { container } = renderWithTheme(
      <EmptyStateCard
        icon={Inbox}
        title="Nothing here yet"
        description="This section will populate over time."
        variant="first-run"
      />,
    );

    expect(container.textContent).toContain('Nothing here yet');
    expect(container.textContent).toContain('This section will populate over time.');
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders as accessible region with aria-label from title', () => {
    const { container } = renderWithTheme(
      <EmptyStateCard
        icon={Inbox}
        title="Test Title"
        description="Test description"
        variant="all-clear"
      />,
    );

    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(region?.getAttribute('aria-label')).toBe('Test Title');
  });

  it('renders CTA as link when href provided', () => {
    const { container } = renderWithTheme(
      <EmptyStateCard
        icon={Inbox}
        title="Title"
        description="Desc"
        ctaLabel="Get started"
        ctaHref="/clients"
        variant="first-run"
      />,
    );

    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/clients');
    expect(link?.textContent).toBe('Get started');
  });

  it('renders CTA as button when onClick provided', () => {
    const onClick = vi.fn();
    const { container } = renderWithTheme(
      <EmptyStateCard
        icon={Inbox}
        title="Title"
        description="Desc"
        ctaLabel="Click me"
        ctaOnClick={onClick}
        variant="first-run"
      />,
    );

    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe('Click me');
    fireEvent.click(button!);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders dashed border for first-run variant', () => {
    const { container } = renderWithTheme(
      <EmptyStateCard
        icon={Inbox}
        title="Title"
        description="Desc"
        variant="first-run"
      />,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-dashed');
  });

  it('renders solid border for all-clear variant', () => {
    const { container } = renderWithTheme(
      <EmptyStateCard
        icon={Inbox}
        title="Title"
        description="Desc"
        variant="all-clear"
      />,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-solid');
  });

  it('does not render CTA when no ctaLabel provided', () => {
    const { container } = renderWithTheme(
      <EmptyStateCard
        icon={Inbox}
        title="Title"
        description="Desc"
        variant="first-run"
      />,
    );

    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});
