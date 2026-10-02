import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const roundedMap: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

export default function Skeleton({
  className = '',
  rounded = 'md',
  style,
  children,
  ...props
}: SkeletonProps) {
  const roundedClass = roundedMap[rounded] || 'rounded-md';
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-stone-200/70 transition-opacity duration-200 ${roundedClass} ${className}`}
      style={style}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      {children}
    </div>
  );
}
