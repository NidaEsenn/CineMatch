'use client';

import { Film } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export default function Loading({
  size = 'md',
  text,
  fullScreen = false,
}: LoadingProps) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-gray-700 border-t-primary-500',
            sizes[size]
          )}
        />
        <Film
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-400',
            size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-5 h-5' : 'w-8 h-8'
          )}
        />
      </div>
      {text && <p className="text-gray-400 text-sm animate-pulse">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}
