import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import {
  DocumentSkeleton,
  KanbanSkeleton,
  TableSkeleton,
  ListCardsSkeleton,
  FormSettingsSkeleton,
  TaskDetailSkeleton,
} from './LayoutSkeletons';

describe('LayoutSkeletons', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders DocumentSkeleton with status role', () => {
    render(<DocumentSkeleton />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('renders KanbanSkeleton with status role and multiple columns', () => {
    render(<KanbanSkeleton />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('renders TableSkeleton with status role', () => {
    render(<TableSkeleton />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('renders ListCardsSkeleton with status role', () => {
    render(<ListCardsSkeleton />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('renders FormSettingsSkeleton with status role', () => {
    render(<FormSettingsSkeleton />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('renders TaskDetailSkeleton with status role', () => {
    render(<TaskDetailSkeleton />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
    expect(el.getAttribute('aria-busy')).toBe('true');
  });
});
