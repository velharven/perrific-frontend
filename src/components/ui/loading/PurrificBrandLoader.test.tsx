import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import PurrificBrandLoader from './PurrificBrandLoader';

describe('PurrificBrandLoader', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders branding and message correctly', () => {
    render(<PurrificBrandLoader message="Menyiapkan sesi..." fullscreen />);
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.className).toContain('fixed inset-0');
    expect(screen.getByText('Menyiapkan sesi...')).toBeTruthy();
  });

  it('renders inline mode without fullscreen overlay class', () => {
    render(<PurrificBrandLoader message="Memuat tim..." />);
    const status = screen.getByRole('status');
    expect(status.className).not.toContain('fixed inset-0');
    expect(screen.getByText('Memuat tim...')).toBeTruthy();
  });
});
