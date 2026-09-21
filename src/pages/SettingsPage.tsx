import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import Avatar from '@/components/ui/Avatar';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import { fileToAvatarDataUrl } from '@/lib/avatar';

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
                className={`inline-flex cursor-pointer items-center rounded-full border border-perrific-line bg-white px-4 py-2 font-givonic text-xs font-semibold text-perrific-graphite transition hover:bg-perrific-paper ${
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
                  className="rounded-full px-3 py-2 font-givonic text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Hapus
                </button>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-perrific-graphite/40">
              JPG/PNG/WebP · maks 5 MB · otomatis dikecilkan
            </p>
            {photoError && (
              <p role="alert" className="mt-1.5 font-givonic text-xs text-red-600">{photoError}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmitProfile} className="mt-5 space-y-4">
          <div>
            <label htmlFor="display-name" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
              Nama tampilan
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Namamu"
              className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
          </div>

          <div>
            <label htmlFor="username" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
              Username
            </label>
            <div className="flex items-center rounded-[10px] border border-perrific-line bg-white px-3 focus-within:border-perrific-violet focus-within:ring-2 focus-within:ring-perrific-violet/20">
              <span className="select-none font-givonic text-sm text-perrific-graphite/40">@</span>
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
                className="w-full bg-transparent px-1.5 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:outline-none"
              />
            </div>
            <div id="username-status" aria-live="polite" className="mt-1.5 min-h-[1rem]">
              {!usernameFormatOk ? (
                <p className="font-givonic text-xs text-red-600">
                  3–30 karakter: huruf kecil, angka, titik, underscore.
                </p>
              ) : usernameUnchanged ? null : checking ? (
                <p className="font-givonic text-xs text-perrific-graphite/50">Memeriksa ketersediaan…</p>
              ) : available === true ? (
                <p className="font-givonic text-xs font-medium text-green-700">Username tersedia.</p>
              ) : available === false ? (
                <p className="font-givonic text-xs font-medium text-red-600">Username sudah dipakai.</p>
              ) : usernameNorm === '' ? (
                <p className="font-givonic text-xs text-perrific-graphite/40">Opsional — kosongkan untuk menghapus.</p>
              ) : null}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white hover:bg-[#E64D0A] disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {saving ? 'Menyimpan…' : 'Simpan profil'}
            </button>
            {notice && (
              <p
                role={notice.type === 'error' ? 'alert' : 'status'}
                className={`mt-2 font-givonic text-xs ${notice.type === 'error' ? 'text-red-600' : 'text-green-700'}`}
              >
                {notice.text}
              </p>
            )}
          </div>
        </form>
        </SettingsBlock>

        <SettingsBlock title="Password" desc="Minimal 8 karakter">
        {!user?.hasPassword && (
          <p className="mt-2 rounded-lg bg-perrific-paper px-3 py-2.5 font-givonic text-xs leading-relaxed text-perrific-graphite/70">
            Akun ini masuk dengan Google. Buat password agar bisa masuk dengan email juga.
          </p>
        )}
        <form onSubmit={handleSubmitPassword} className="mt-4 space-y-4">
          {user?.hasPassword && (
            <div>
              <label htmlFor="current-password" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
                Password saat ini
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
              />
            </div>
          )}
          <div>
            <label htmlFor="new-password" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
              Password baru
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
              Ulangi password baru
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
            {pwMismatch && (
              <p className="mt-1.5 font-givonic text-xs text-red-600">Konfirmasi tidak cocok.</p>
            )}
          </div>
          <div>
            <button
              type="submit"
              disabled={!canSubmitPw}
              className="rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white hover:bg-[#E64D0A] disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {pwBusy ? 'Menyimpan…' : 'Ubah password'}
            </button>
            {pwMsg && (
              <p
                role={pwMsg.type === 'error' ? 'alert' : 'status'}
                className={`mt-2 font-givonic text-xs ${pwMsg.type === 'error' ? 'text-red-600' : 'text-green-700'}`}
              >
                {pwMsg.text}
              </p>
            )}
          </div>
        </form>
        </SettingsBlock>

        <SettingsBlock title="Akun" desc="Info akun & keluar">
        <dl className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-givonic text-sm text-perrific-graphite/60">Email</dt>
            <dd className="truncate font-mono text-xs text-perrific-graphite">{user?.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-givonic text-sm text-perrific-graphite/60">Username</dt>
            <dd className="truncate font-mono text-xs text-perrific-graphite">
              {user?.username ? `@${user.username}` : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-givonic text-sm text-perrific-graphite/60">Bergabung sejak</dt>
            <dd className="font-givonic text-sm text-perrific-graphite">{memberSince}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-2.5 font-givonic text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3H3.5v10H6M10.5 5.5L13 8l-2.5 2.5M13 8H6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Keluar
          </button>
        </div>
        </SettingsBlock>
      </div>
    </div>
  );
}
