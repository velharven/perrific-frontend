import { useState } from 'react';
import { useAuth } from '@/store/auth';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';

/**
 * Modal wajib isi username — muncul untuk akun tanpa username
 * (mis. login Google pertama kali). Tidak bisa ditutup sampai tersimpan.
 */
export default function UsernameModal() {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { norm, formatOk, checking, available } = useUsernameAvailability(username);

  if (!user || user.username) return null;

  const invalid = norm !== '' && !formatOk;
  const taken = available === false;
  const ready = norm !== '' && formatOk && !taken && !checking && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ username: norm });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Gagal menyimpan username. Coba lagi.';
      setError(message);
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-perrific-line bg-white p-6 shadow-[0_16px_48px_rgba(26,26,30,0.2)]">
        <div className="flex items-center gap-3">
          <img src="/Purrific.svg" alt="" aria-hidden="true" width="32" height="32" className="h-8 w-8" />
          <div>
            <h2 id="username-modal-title" className="font-manrope text-lg font-extrabold text-perrific-graphite">
              Satu langkah lagi
            </h2>
            <p className="font-manrope text-xs text-perrific-graphite/60">
              Pilih username untuk akunmu — wajib diisi untuk lanjut.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <label htmlFor="modal-username" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
            Username
          </label>
          <div className="flex items-center rounded-[10px] border border-perrific-line bg-white px-3 focus-within:border-perrific-violet focus-within:ring-2 focus-within:ring-perrific-violet/20">
            <span className="select-none font-manrope text-sm text-perrific-graphite/40">@</span>
            <input
              id="modal-username"
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={30}
              placeholder="namapengguna"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              aria-describedby="modal-username-status"
              className="w-full bg-transparent px-1.5 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:outline-none"
            />
          </div>
          <div id="modal-username-status" aria-live="polite" className="mt-1.5 min-h-[1rem]">
            {invalid ? (
              <p className="font-manrope text-xs text-red-600">
                3–30 karakter: huruf kecil, angka, titik, underscore.
              </p>
            ) : checking ? (
              <p className="font-manrope text-xs text-perrific-graphite/50">Memeriksa ketersediaan…</p>
            ) : taken ? (
              <p className="font-manrope text-xs font-medium text-red-600">Username sudah dipakai.</p>
            ) : available === true ? (
              <p className="font-manrope text-xs font-medium text-green-700">Username tersedia.</p>
            ) : null}
          </div>
          {error && (
            <p role="alert" className="mt-2 font-manrope text-xs text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={!ready}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-perrific-violet px-6 py-3 font-manrope text-sm font-semibold text-white hover:bg-[#E64D0A] disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {saving ? 'Menyimpan…' : 'Simpan & lanjut'}
          </button>
        </form>
      </div>
    </div>
  );
}
