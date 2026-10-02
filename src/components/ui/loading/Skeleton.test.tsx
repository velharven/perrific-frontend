import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('renders with base shimmer classes and aria attributes', () => {
    render(<Skeleton data-testid="test-skeleton" className="h-6 w-24" rounded="md" />);
    const el = screen.getByTestId('test-skeleton');
    expect(el).toBeTruthy();
    expect(el.className).toContain('h-6');
    expect(el.className).toContain('w-24');
    expect(el.className).toContain('rounded-md');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('supports custom rounded variants', () => {
    render(<Skeleton data-testid="pill-skeleton" rounded="full" />);
    const el = screen.getByTestId('pill-skeleton');
    expect(el).toBeTruthy();
    expect(el.className).toContain('rounded-full');
  });
});
