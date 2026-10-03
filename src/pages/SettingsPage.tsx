import { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import Avatar from '@/components/ui/Avatar';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

function apiMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { message?: unknown } } }).response;
    if (typeof r?.data?.message === 'string' && r.data.message) return r.data.message;
  }
  return fallback;
}

type Notice = { type: 'success' | 'error'; text: string } | null;

export default function SettingsPage() {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const {
    status: gcalStatus,
    connecting: gcalConnecting,
    error: gcalError,
    connect: connectGcal,
    disconnect: disconnectGcal,
  } = useGoogleCalendar();

  // ---- Profil: nama + username ----
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const { norm: usernameNorm, formatOk, checking, available } =
    useUsernameAvailability(username);

  // ---- Foto profil ----
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ---- Password ----
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Notice>(null);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const usernameUnchanged = usernameNorm === (user?.username ?? '');
  // Username boleh dikosongkan (menghapus username); kalau diisi harus lolos format hook
  const usernameFormatOk = usernameNorm === '' || formatOk;

  const nameChanged = name.trim() !== '' && name.trim() !== (user?.name ?? '');
  const usernameChanged = !usernameUnchanged;
  const canSave =
    (nameChanged || usernameChanged) &&
    usernameFormatOk &&
    available !== false &&
    !checking &&
    !saving;

  async function handleSubmitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setNotice(null);
    try {
      const body: { name?: string; username?: string | null } = {};
      if (nameChanged) body.name = name.trim();
      if (usernameChanged) body.username = usernameNorm === '' ? null : usernameNorm;
      await updateProfile(body);
      setNotice({ type: 'success', text: 'Profil berhasil diperbarui.' });
    } catch (err) {
      setNotice({ type: 'error', text: apiMessage(err, 'Gagal menyimpan. Coba lagi.') });
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoFile(file: File | undefined) {
    if (!file || photoBusy) return;
    setPhotoError(null);
    if (!file.type.startsWith('image/')) {
      setPhotoError('File harus berupa gambar.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Ukuran maksimal 5 MB.');
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await updateProfile({ avatarUrl: dataUrl });
    } catch {
      setPhotoError('Gagal mengunggah foto. Coba lagi.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    if (photoBusy) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await updateProfile({ avatarUrl: null });
    } catch {
      setPhotoError('Gagal menghapus foto. Coba lagi.');
    } finally {
      setPhotoBusy(false);
    }
  }

  const pwMismatch = confirmPw !== '' && newPw !== confirmPw;
  const canSubmitPw =
    newPw.length >= 8 && !pwMismatch && (user?.hasPassword ? currentPw !== '' : true) && !pwBusy;

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitPw) return;
    setPwBusy(true);
    setPwMsg(null);
    try {
      await changePassword({
        ...(user?.hasPassword ? { currentPassword: currentPw } : {}),
        newPassword: newPw,
      });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ type: 'success', text: 'Password berhasil diubah.' });
    } catch (err) {
      setPwMsg({ type: 'error', text: apiMessage(err, 'Gagal mengubah password. Coba lagi.') });
    } finally {
      setPwBusy(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Kelola akun dan preferensimu</p>
      </div>
      <div className="space-y-5">
        <SettingsBlock title="Profil" desc="Nama, username & foto">
        <div className="mt-4 flex items-center gap-4">
          <Avatar src={user?.avatarUrl} name={user?.name} size={80} alt="Foto profil" className="h-20 w-20 text-2xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="photo-input"
                className={`inline-flex cursor-pointer items-center rounded-full border border-perrific-line bg-white px-4 py-2 font-manrope text-xs font-semibold text-perrific-graphite transition hover:bg-perrific-paper ${
                  photoBusy ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {photoBusy ? 'Mengunggah…' : user?.avatarUrl ? 'Ubah foto' : 'Tambah foto'}
              </label>
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={photoBusy}
                onChange={(e) => {
                  handlePhotoFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={photoBusy}
                  className="rounded-full px-3 py-2 font-manrope text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Hapus
                </button>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-perrific-graphite/40">
              JPG/PNG/WebP · maks 5 MB · otomatis dikecilkan
            </p>
            {photoError && (
              <p role="alert" className="mt-1.5 font-manrope text-xs text-red-600">{photoError}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmitProfile} className="mt-5 space-y-4">
          <div>
            <label htmlFor="display-name" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
              Nama tampilan
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Namamu"
              className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
          </div>

          <div>
            <label htmlFor="username" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
              Username
            </label>
            <div className="flex items-center rounded-[10px] border border-perrific-line bg-white px-3 focus-within:border-perrific-violet focus-within:ring-2 focus-within:ring-perrific-violet/20">
              <span className="select-none font-manrope text-sm text-perrific-graphite/40">@</span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={30}
                placeholder="namapengguna"
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby="username-status"
                className="w-full bg-transparent px-1.5 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:outline-none"
              />
            </div>
            <div id="username-status" aria-live="polite" className="mt-1.5 min-h-[1rem]">
              {!usernameFormatOk ? (
                <p className="font-manrope text-xs text-red-600">
                  3–30 karakter: huruf kecil, angka, titik, underscore.
                </p>
              ) : usernameUnchanged ? null : checking ? (
                <p className="font-manrope text-xs text-perrific-graphite/50">Memeriksa ketersediaan…</p>
              ) : available === true ? (
                <p className="font-manrope text-xs font-medium text-green-700">Username tersedia.</p>
              ) : available === false ? (
                <p className="font-manrope text-xs font-medium text-red-600">Username sudah dipakai.</p>
              ) : usernameNorm === '' ? (
                <p className="font-manrope text-xs text-perrific-graphite/40">Opsional — kosongkan untuk menghapus.</p>
              ) : null}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-full bg-perrific-violet px-5 py-2.5 font-manrope text-sm font-semibold text-white hover:bg-[#E64D0A] disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {saving ? 'Menyimpan…' : 'Simpan profil'}
            </button>
            {notice && (
              <p
                role={notice.type === 'error' ? 'alert' : 'status'}
                className={`mt-2 font-manrope text-xs ${notice.type === 'error' ? 'text-red-600' : 'text-green-700'}`}
              >
                {notice.text}
              </p>
            )}
          </div>
        </form>
        </SettingsBlock>

        <SettingsBlock title="Password" desc="Minimal 8 karakter">
        {!user?.hasPassword && (
          <p className="mt-2 rounded-lg bg-perrific-paper px-3 py-2.5 font-manrope text-xs leading-relaxed text-perrific-graphite/70">
            Akun ini masuk dengan Google. Buat password agar bisa masuk dengan email juga.
          </p>
        )}
        <form onSubmit={handleSubmitPassword} className="mt-4 space-y-4">
          {user?.hasPassword && (
            <div>
              <label htmlFor="current-password" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
                Password saat ini
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
              />
            </div>
          )}
          <div>
            <label htmlFor="new-password" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
              Password baru
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
              Ulangi password baru
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
            {pwMismatch && (
              <p className="mt-1.5 font-manrope text-xs text-red-600">Konfirmasi tidak cocok.</p>
            )}
          </div>
          <div>
            <button
              type="submit"
              disabled={!canSubmitPw}
              className="rounded-full bg-perrific-violet px-5 py-2.5 font-manrope text-sm font-semibold text-white hover:bg-[#E64D0A] disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {pwBusy ? 'Menyimpan…' : 'Ubah password'}
            </button>
            {pwMsg && (
              <p
                role={pwMsg.type === 'error' ? 'alert' : 'status'}
                className={`mt-2 font-manrope text-xs ${pwMsg.type === 'error' ? 'text-red-600' : 'text-green-700'}`}
              >
                {pwMsg.text}
              </p>
            )}
          </div>
        </form>
        </SettingsBlock>

        <SettingsBlock
          title="Integrasi Google Calendar"
          desc="Sinkronkan jadwal aktivitas harian personal dengan Google Calendar Anda secara 2 arah"
        >
          <div className="mt-3 flex flex-col gap-3">
            {gcalStatus.connected ? (
              <div className="flex flex-col gap-3 rounded-[12px] border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-10 w-10 shrink-0">
                      {gcalStatus.avatarUrl ? (
                        <img
                          src={gcalStatus.avatarUrl}
                          alt={gcalStatus.name || 'Google Profile'}
                          className="h-10 w-10 rounded-full object-cover shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-sm">
                          {(gcalStatus.name || gcalStatus.email || 'G').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-white shadow-xs">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-manrope text-sm font-semibold text-perrific-graphite">
                        {gcalStatus.name || 'Akun Google'}
                      </p>
                      {gcalStatus.email && (
                        <p className="truncate font-manrope text-xs text-perrific-graphite/70">
                          {gcalStatus.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void disconnectGcal()}
                    className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-1.5 font-manrope text-xs font-medium text-gray-700 hover:bg-gray-50 transition shadow-xs"
                  >
                    Putuskan
                  </button>
                </div>
                {gcalStatus.syncedAt && (
                  <p className="font-manrope text-xs text-gray-500 pt-2 border-t border-blue-100">
                    Terakhir disinkronkan: {new Date(gcalStatus.syncedAt).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-[12px] border border-perrific-line bg-perrific-paper/50 p-4">
                <div>
                  <p className="font-manrope text-sm font-semibold text-perrific-graphite">
                    Belum terhubung
                  </p>
                  <p className="font-manrope text-xs text-perrific-graphite/60">
                    Hubungkan akun Google untuk menampilkan jadwal di kalender dan sinkronisasi aktivitas harian.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={gcalConnecting}
                  onClick={connectGcal}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-perrific-line bg-white px-5 py-2 font-manrope text-xs font-semibold text-perrific-graphite shadow-sm hover:bg-perrific-paper transition disabled:opacity-60"
                >
                  {gcalConnecting ? 'Menghubungkan…' : 'Hubungkan'}
                </button>
              </div>
            )}
            {gcalError && (
              <p role="alert" className="font-manrope text-xs text-red-600">
                {gcalError}
              </p>
            )}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-perrific-graphite/60 font-manrope">
              <ShieldCheck size={13} className="shrink-0 text-perrific-wood" />
              <span>
                Koneksi dienkripsi dengan AES-256-GCM dan mematuhi Kebijakan Penggunaan Terbatas Google API.{' '}
                <Link to="/privacy" className="text-perrific-violet font-medium underline underline-offset-2 hover:text-[#E64D0A] transition">
                  Pelajari selengkapnya di Kebijakan Privasi
                </Link>
              </span>
            </div>
          </div>
        </SettingsBlock>

        <SettingsBlock title="Akun" desc="Info akun & keluar">
        <dl className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-manrope text-sm text-perrific-graphite/60">Email</dt>
            <dd className="truncate font-mono text-xs text-perrific-graphite">{user?.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-manrope text-sm text-perrific-graphite/60">Username</dt>
            <dd className="truncate font-mono text-xs text-perrific-graphite">
              {user?.username ? `@${user.username}` : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-manrope text-sm text-perrific-graphite/60">Bergabung sejak</dt>
            <dd className="font-manrope text-sm text-perrific-graphite">{memberSince}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-2.5 font-manrope text-sm font-semibold text-red-600 transition hover:bg-red-50 cursor-pointer"
          >
            <LogOut size={15} strokeWidth={1.6} aria-hidden="true" />
            Keluar
          </button>
        </div>
        </SettingsBlock>
      </div>
    </div>
  );
}
