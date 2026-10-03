import { useState, useEffect } from 'react';
import { User } from 'lucide-react';

type AvatarProps = {
  src?: string | null;
  name?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  fallback?: 'initial' | 'silhouette';
};

/**
 * Avatar aman untuk Google lh3.googleusercontent.com:
 * - referrerPolicy="no-referrer" mencegah 403 di beberapa browser/laptop
 *   yang mengirim Referer (penyebab "di laptop lain muncul, di sini tidak")
 * - onError fallback ke inisial atau siluet ikon agar tidak tampil broken image
 * - tidak menimpa foto custom data:image/... dari /settings
 */
export default function Avatar({
  src,
  name,
  alt,
  size = 36,
  className = '',
  fallback = 'initial',
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = (name?.trim()?.charAt(0) ?? '?').toUpperCase();
  const dimension = `${size}px`;

  if (src && !failed) {
    // Wrapper berkuran tetap + overflow-hidden: kotak lingkaran tidak akan
    // pernah gepeng/terjepit oleh flex parent, img selalu fill + cover.
    return (
      <span
        className={`aspect-square shrink-0 select-none overflow-hidden rounded-full ${className}`}
        style={{ width: dimension, height: dimension }}
      >
        <img
          src={src}
          alt={alt ?? name ?? 'Avatar'}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </span>
    );
  }

  if (fallback === 'silhouette') {
    const iconSize = Math.max(12, Math.round(size * 0.55));
    return (
      <span
        aria-hidden="true"
        data-testid="avatar-silhouette"
        className={`flex shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 border border-gray-200/80 ${className}`}
        style={{ width: dimension, height: dimension }}
      >
        <User size={iconSize} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-perrific-violet font-manrope font-bold text-white ${className}`}
      style={{ width: dimension, height: dimension, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}
