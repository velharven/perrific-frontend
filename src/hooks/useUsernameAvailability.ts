import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/**
 * Cek ketersediaan username ke server (debounce).
 * Mengembalikan status + apakah format valid.
 */
export function useUsernameAvailability(raw: string, delay = 400) {
  const norm = raw.trim();
  const formatOk = USERNAME_RE.test(norm);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!formatOk) {
      setAvailable(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/auth/check-username', { params: { username: norm } });
        setAvailable(res.data.data.available as boolean);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [norm, formatOk, delay]);

  let status: UsernameStatus = 'idle';
  if (norm !== '' && !formatOk) status = 'invalid';
  else if (checking) status = 'checking';
  else if (available === true) status = 'available';
  else if (available === false) status = 'taken';

  return { norm, formatOk, checking, available, status };
}
