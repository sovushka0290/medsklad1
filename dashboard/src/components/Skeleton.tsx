import { memo } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  count?: number;
}

export const Skeleton = memo(function Skeleton({ 
  className = '', 
  variant = 'text', 
  count = 1 
}: SkeletonProps) {
  const baseClass = 'bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg';
  const variantClass = {
    text: 'h-4 w-full my-1.5',
    rect: 'h-24 w-full',
    circle: 'h-10 w-10 rounded-full',
  }[variant];

  const items = Array.from({ length: count });

  if (count === 1) {
    return <div className={`${baseClass} ${variantClass} ${className}`} />;
  }

  return (
    <div className="space-y-2 w-full">
      {items.map((_, idx) => (
        <div key={idx} className={`${baseClass} ${variantClass} ${className}`} />
      ))}
    </div>
  );
});

export default Skeleton;
// Default export for lazy loading or import convenience
