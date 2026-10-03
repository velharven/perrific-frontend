import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsOfServicePage from './TermsOfServicePage';
import Footer from '@/components/landing/Footer';
import SettingsPage from './SettingsPage';

// Mocks for SettingsPage dependencies
vi.mock('@/store/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Test User', email: 'test@example.com', username: 'testuser', createdAt: '2026-01-01' },
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useUsernameAvailability', () => ({
  useUsernameAvailability: () => ({
    norm: 'testuser',
    formatOk: true,
    checking: false,
    available: true,
  }),
}));

vi.mock('@/hooks/useGoogleCalendar', () => ({
  useGoogleCalendar: () => ({
    status: { connected: false, email: null, name: null, avatarUrl: null, syncedAt: null },
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    syncNow: vi.fn(),
  }),
}));

describe('Legal & Compliance Pages', () => {
  beforeAll(() => {
    window.scrollTo = vi.fn();
  });

  afterEach(cleanup);

  describe('PrivacyPolicyPage', () => {
    it('renders the header, title, back button, and sets document.title', () => {
      render(
        <MemoryRouter>
          <PrivacyPolicyPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 1, name: /Kebijakan Privasi Purrific/i })).toBeTruthy();
      const backLink = screen.getAllByRole('link', { name: /Kembali ke Beranda/i })[0];
      expect(backLink.getAttribute('href')).toBe('/');
      expect(document.title).toBe('Kebijakan Privasi | Purrific');
    });

    it('displays the Google Calendar scope and Limited Use disclosure clause in both ID and EN', () => {
      render(
        <MemoryRouter>
          <PrivacyPolicyPage />
        </MemoryRouter>
      );

      // Verify OAuth scope
      expect(screen.getByText(/https:\/\/www\.googleapis\.com\/auth\/calendar\.events/i)).toBeTruthy();

      // Verify Indonesian Google Limited Use Disclosure clause
      expect(
        screen.getByText(
          /Penggunaan dan transfer informasi yang diterima oleh Purrific dari Google API ke aplikasi lain akan mematuhi Kebijakan Data Pengguna Layanan Google API \(Google API Services User Data Policy\), termasuk persyaratan Penggunaan Terbatas \(Limited Use requirements\)\./i
        )
      ).toBeTruthy();

      // Verify Verbatim English Google Limited Use Disclosure clause
      expect(
        screen.getByText(
          /Purrific's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements\./i
        )
      ).toBeTruthy();
    });

    it('displays security encryption and user control sections', () => {
      render(
        <MemoryRouter>
          <PrivacyPolicyPage />
        </MemoryRouter>
      );

      // Security & AES-256-GCM
      expect(screen.getByText(/Enkripsi AES-256-GCM at Rest/i)).toBeTruthy();

      // User control and disconnect instructions
      expect(screen.getByRole('heading', { level: 2, name: /Kontrol Pengguna & Pencabutan Akses/i })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: /Kontak \/ Hubungi Kami/i })).toBeTruthy();
      expect(screen.getByRole('link', { name: /support@purrific\.app/i }).getAttribute('href')).toBe('mailto:support@purrific.app');
    });
  });

  describe('TermsOfServicePage', () => {
    it('renders the title, back button, sets document.title, and all required sections', () => {
      render(
        <MemoryRouter>
          <TermsOfServicePage />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 1, name: /Syarat dan Ketentuan Layanan/i })).toBeTruthy();
      const backLink = screen.getAllByRole('link', { name: /Kembali ke Beranda/i })[0];
      expect(backLink.getAttribute('href')).toBe('/');
      expect(document.title).toBe('Syarat dan Ketentuan Layanan | Purrific');

      expect(screen.getByRole('heading', { level: 2, name: /Penerimaan Ketentuan/i })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: /Akun dan Tanggung Jawab Pengguna/i })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: /Hak Kekayaan Intelektual dan Kepemilikan Konten Pengguna/i })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: /Batasan Penggunaan yang Sah/i })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: /Batasan Tanggung Jawab & Ketersediaan Layanan/i })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2, name: /Perubahan Ketentuan/i })).toBeTruthy();
    });
  });

  describe('Footer Links', () => {
    it('contains links to /privacy and /terms', () => {
      render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      );

      const privacyLink = screen.getByRole('link', { name: /Kebijakan Privasi/i });
      const termsLink = screen.getByRole('link', { name: /Syarat & Ketentuan/i });

      expect(privacyLink.getAttribute('href')).toBe('/privacy');
      expect(termsLink.getAttribute('href')).toBe('/terms');
    });
  });

  describe('SettingsPage Google Calendar Compliance Notice', () => {
    it('renders subtle Google API policy and encryption notice with link to /privacy', () => {
      render(
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Koneksi dienkripsi dengan AES-256-GCM dan mematuhi Kebijakan Penggunaan Terbatas Google API\./i)
      ).toBeTruthy();

      const privacyNoticeLink = screen.getByRole('link', { name: /Pelajari selengkapnya di Kebijakan Privasi/i });
      expect(privacyNoticeLink.getAttribute('href')).toBe('/privacy');
    });
  });
});
