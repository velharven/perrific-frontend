import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FloatingMobileBurger from './FloatingMobileBurger';

describe('FloatingMobileBurger Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Default window dimensions
    window.innerWidth = 360;
    window.innerHeight = 640;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly with default position', () => {
    const onOpen = vi.fn();
    render(<FloatingMobileBurger onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /Buka menu navigasi/i });
    expect(button).toBeTruthy();
    expect(button.style.transform).toBe('translate3d(16px, 16px, 0)');
  });

  it('triggers onOpen when clicked/tapped without drag', () => {
    const onOpen = vi.fn();
    render(<FloatingMobileBurger onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /Buka menu navigasi/i });

    // Pointer down at (50, 50)
    fireEvent.pointerDown(button, { clientX: 50, clientY: 50, button: 0, pointerId: 1 });
    // Pointer up at (51, 51) — movement <= 5px is a tap
    fireEvent.pointerUp(button, { clientX: 51, clientY: 51, button: 0, pointerId: 1 });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('updates position when dragged and saves to localStorage without triggering onOpen', () => {
    const onOpen = vi.fn();
    render(<FloatingMobileBurger onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /Buka menu navigasi/i });

    // Pointer down at (50, 50) where initial pos is (16, 16)
    fireEvent.pointerDown(button, { clientX: 50, clientY: 50, button: 0, pointerId: 1 });
    // Move by +100px on X and +150px on Y
    fireEvent.pointerMove(button, { clientX: 150, clientY: 200, pointerId: 1 });
    // Pointer up
    fireEvent.pointerUp(button, { clientX: 150, clientY: 200, button: 0, pointerId: 1 });

    expect(onOpen).not.toHaveBeenCalled();

    // 16 + 100 = 116, 16 + 150 = 166
    expect(button.style.transform).toBe('translate3d(116px, 166px, 0)');

    const saved = localStorage.getItem('purrific:floating-burger-pos');
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.x).toBe(116);
    expect(parsed.y).toBe(166);
  });

  it('clamps position within viewport boundaries when dragged beyond screen edges', () => {
    const onOpen = vi.fn();
    render(<FloatingMobileBurger onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /Buka menu navigasi/i });

    // Drag far to the right and bottom beyond 360x640 screen
    fireEvent.pointerDown(button, { clientX: 50, clientY: 50, button: 0, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: 1000, clientY: 1000, pointerId: 1 });
    fireEvent.pointerUp(button, { clientX: 1000, clientY: 1000, button: 0, pointerId: 1 });

    // maxX = 360 - 48 - 8 = 304, maxY = 640 - 48 - 8 = 584
    expect(button.style.transform).toBe('translate3d(304px, 584px, 0)');

    // Drag far to the left and top into negative coordinates
    fireEvent.pointerDown(button, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: -500, clientY: -500, pointerId: 1 });
    fireEvent.pointerUp(button, { clientX: -500, clientY: -500, button: 0, pointerId: 1 });

    // minX = 8, minY = 8
    expect(button.style.transform).toBe('translate3d(8px, 8px, 0)');
  });

  it('loads saved position from localStorage', () => {
    localStorage.setItem('purrific:floating-burger-pos', JSON.stringify({ x: 80, y: 120 }));

    const onOpen = vi.fn();
    render(<FloatingMobileBurger onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: /Buka menu navigasi/i });
    expect(button.style.transform).toBe('translate3d(80px, 120px, 0)');
  });

  it('hides button when hidden prop is true', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<FloatingMobileBurger onOpen={onOpen} hidden={false} />);

    let button = screen.getByRole('button', { name: /Buka menu navigasi/i });
    expect(button.className).toContain('opacity-100');

    rerender(<FloatingMobileBurger onOpen={onOpen} hidden={true} />);
    button = screen.getByRole('button', { name: /Buka menu navigasi/i });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('pointer-events-none');
  });
});
