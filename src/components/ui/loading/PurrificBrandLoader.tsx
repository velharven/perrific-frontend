import { Loader2 } from 'lucide-react';

export interface PurrificBrandLoaderProps {
  message?: string;
  fullscreen?: boolean;
  className?: string;
}

export default function PurrificBrandLoader({
  message = 'Memuat...',
  fullscreen = false,
  className = '',
}: PurrificBrandLoaderProps) {
  const containerClass = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-perrific-paper/95 backdrop-blur-sm'
    : 'flex flex-col items-center justify-center py-12';

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`${containerClass} transition-opacity duration-200 animate-fadeIn ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle breathing glow */}
        <div className="absolute h-16 w-16 animate-ping rounded-full bg-primary/10 opacity-75" />
        <img
          src="/Purrific.svg"
          alt="Purrific Logo"
          className="relative h-10 w-10 drop-shadow-sm transition-transform duration-300 hover:scale-105"
        />
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        <p className="font-manrope text-sm font-medium tracking-wide text-perrific-graphite/80">
          {message}
        </p>
      </div>
    </div>
  );
}
