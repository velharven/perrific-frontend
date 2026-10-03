import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import ComparisonSection from './ComparisonSection';

describe('ComparisonSection Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders comparison section without mentioning Notion or Taiga anywhere in the text', () => {
    render(<ComparisonSection />);

    // Memastikan kata "Notion" dan "Taiga" sama sekali tidak muncul di UI
    expect(screen.queryAllByText(/notion/i)).toEqual([]);
    expect(screen.queryAllByText(/taiga/i)).toEqual([]);

    // Memastikan judul perbandingan yang generik dan profesional tampil
    expect(screen.getByRole('heading', { level: 2, name: /Purrific vs\./i })).toBeTruthy();

    // Memastikan kolom Purrific dan kolom perbandingan alternatif tampil
    expect(screen.getByText('PURRIFIC')).toBeTruthy();
    expect(screen.getByText('WORKSPACE DOKUMEN')).toBeTruthy();
    expect(screen.getByText('PROJECT MANAGEMENT')).toBeTruthy();
  });
});
