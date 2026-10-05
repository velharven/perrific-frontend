import { describe, it, expect } from 'vitest';
import { buildJoinLink, formatExpiryText, matchPreset } from './invite';

describe('invite helpers', () => {
  it('builds join link using encrypted token or code', () => {
    const token = 'v1_encrypted_token_123';
    const link = buildJoinLink(token);
    expect(link).toContain(`/join/${token}`);
  });

  it('formats expiry date correctly', () => {
    expect(formatExpiryText(null)).toBe('Tanpa batas waktu');
    expect(formatExpiryText(undefined)).toBe('Tanpa batas waktu');
    expect(formatExpiryText('invalid-date')).toBe('Tanpa batas waktu');

    const pastDate = new Date(Date.now() - 10000).toISOString();
    expect(formatExpiryText(pastDate)).toBe('Sudah kedaluwarsa');

    const futureDate = new Date(Date.now() + 3600_000 * 5).toISOString();
    expect(formatExpiryText(futureDate)).toContain('Berlaku sampai');
  });

  it('matches presets within tolerance', () => {
    const oneHourFromNow = new Date(Date.now() + 3600_000).toISOString();
    expect(matchPreset(oneHourFromNow)).toBe(1);

    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    expect(matchPreset(sevenDaysFromNow)).toBe(168);
  });
});
