import { useSearchParams } from 'react-router-dom';

// Baca target lanjutan login dari ?next= (hanya path internal).
export function useNextPath(fallback = '/dashboard'): string {
  const [params] = useSearchParams();
  const next = params.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
