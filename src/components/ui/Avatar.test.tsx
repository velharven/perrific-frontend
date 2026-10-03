import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import Avatar from './Avatar';

describe('Avatar Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders img element when src is provided', () => {
    render(<Avatar src="https://example.com/avatar.jpg" name="John Doe" size={32} />);
    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
    expect(img.getAttribute('alt')).toBe('John Doe');
  });

  it('renders initial letter with default fallback="initial" when src is null or empty', () => {
    render(<Avatar src={null} name="Budi Santoso" size={32} />);
    const initial = screen.getByText('B');
    expect(initial).toBeTruthy();
    expect(initial.className).toContain('bg-perrific-violet');
  });

  it('renders silhouette user icon when fallback="silhouette" and src is null', () => {
    render(<Avatar src={null} name="Budi Santoso" size={32} fallback="silhouette" />);
    const silhouette = screen.getByTestId('avatar-silhouette');
    expect(silhouette).toBeTruthy();
    expect(silhouette.className).toContain('bg-gray-100');
    expect(silhouette.className).toContain('text-gray-500');
    expect(screen.queryByText('B')).toBeNull();
  });

  it('falls back to silhouette user icon when fallback="silhouette" and image triggers onError', () => {
    render(<Avatar src="https://broken-image.com/avatar.png" name="Budi Santoso" size={32} fallback="silhouette" />);
    const img = screen.getByRole('img');
    fireEvent.error(img);

    const silhouette = screen.getByTestId('avatar-silhouette');
    expect(silhouette).toBeTruthy();
    expect(silhouette.className).toContain('bg-gray-100');
  });
});
