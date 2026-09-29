import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import RecurrenceScopeModal from './RecurrenceScopeModal';
import { formatFollowingScopeLabel, doesActivityOccurOnDate, getDayBefore } from '@/lib/recurrence';
import type { RecurrenceConfig } from '@/types';

describe('RecurrenceScopeModal Component', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });
  it('renders correctly with 3 scope options for edit action', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RecurrenceScopeModal
        isOpen={true}
        actionType="move"
        targetDate="2026-09-29" // Tuesday
        recurrence={{
          freq: 'WEEKLY',
          interval: 1,
          byDays: [2],
          endType: 'NEVER',
        }}
        activityTitle="Sprint Review"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Pindahkan Kegiatan Berulang')).toBeTruthy();
    expect(screen.getByText(/Sprint Review/i)).toBeTruthy();

    // Option 1
    expect(screen.getByText('Event ini')).toBeTruthy();
    // Option 2 (Dynamic with day name)
    expect(screen.getByText('Event ini dan hari Selasa seterusnya')).toBeTruthy();
    // Option 3
    expect(screen.getByText('Semua event')).toBeTruthy();

    // Default selected option is THIS_EVENT
    const applyBtn = screen.getByRole('button', { name: 'Terapkan' });
    fireEvent.click(applyBtn);
    expect(onSelect).toHaveBeenCalledWith('THIS_EVENT');
  });

  it('selects THIS_AND_FOLLOWING and confirms', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RecurrenceScopeModal
        isOpen={true}
        actionType="time"
        targetDate="2026-09-29"
        recurrence={{
          freq: 'WEEKLY',
          interval: 1,
          byDays: [2],
          endType: 'NEVER',
        }}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('Event ini dan hari Selasa seterusnya'));
    fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));

    expect(onSelect).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  });

  it('selects ALL_EVENTS and confirms', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RecurrenceScopeModal
        isOpen={true}
        actionType="rename"
        targetDate="2026-09-29"
        activityTitle="Daily Scrum"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('Semua event'));
    fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));

    expect(onSelect).toHaveBeenCalledWith('ALL_EVENTS');
  });

  it('renders delete action type styling and button', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RecurrenceScopeModal
        isOpen={true}
        actionType="delete"
        targetDate="2026-09-29"
        activityTitle="Gym Session"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Hapus Kegiatan Berulang')).toBeTruthy();
    const deleteBtn = screen.getByRole('button', { name: 'Hapus' });
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn);
    expect(onSelect).toHaveBeenCalledWith('THIS_EVENT');
  });

  it('calls onClose when clicking Batal or pressing Escape', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <RecurrenceScopeModal
        isOpen={true}
        actionType="color"
        targetDate="2026-09-29"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('formatFollowingScopeLabel & recurrence helpers', () => {
  it('formats weekly following label with specific day name', () => {
    // 2026-09-29 is Tuesday (Selasa)
    const labelWeekly = formatFollowingScopeLabel('2026-09-29', {
      freq: 'WEEKLY',
      interval: 1,
      endType: 'NEVER',
    });
    expect(labelWeekly).toBe('Event ini dan hari Selasa seterusnya');
  });

  it('formats daily following label', () => {
    const labelDaily = formatFollowingScopeLabel('2026-09-29', {
      freq: 'DAILY',
      interval: 1,
      endType: 'NEVER',
    });
    expect(labelDaily).toBe('Event ini dan hari seterusnya');
  });

  it('formats monthly following label with day of month', () => {
    const labelMonthly = formatFollowingScopeLabel('2026-09-29', {
      freq: 'MONTHLY',
      interval: 1,
      endType: 'NEVER',
    });
    expect(labelMonthly).toBe('Event ini dan tanggal 29 seterusnya');
  });

  it('getDayBefore computes previous calendar date correctly', () => {
    expect(getDayBefore('2026-09-29')).toBe('2026-09-28');
    expect(getDayBefore('2026-10-01')).toBe('2026-09-30');
    expect(getDayBefore('2026-01-01')).toBe('2025-12-31');
  });

  it('doesActivityOccurOnDate honors excludeDates', () => {
    const recurrence: RecurrenceConfig = {
      freq: 'DAILY',
      interval: 1,
      endType: 'NEVER',
      excludeDates: ['2026-09-29'],
    };

    expect(doesActivityOccurOnDate('2026-09-28', recurrence, '2026-09-28')).toBe(true);
    // 2026-09-29 is excluded!
    expect(doesActivityOccurOnDate('2026-09-28', recurrence, '2026-09-29')).toBe(false);
    // 2026-09-30 is still included!
    expect(doesActivityOccurOnDate('2026-09-28', recurrence, '2026-09-30')).toBe(true);
  });
});
