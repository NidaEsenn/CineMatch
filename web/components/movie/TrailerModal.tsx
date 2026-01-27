'use client';

import { useEffect, useCallback } from 'react';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Movie } from '@/lib/types';

interface TrailerModalProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onLike?: () => void;
  onPass?: () => void;
  showActions?: boolean;
}

export default function TrailerModal({
  movie,
  isOpen,
  onClose,
  onLike,
  onPass,
  showActions = false,
}: TrailerModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !movie.trailerKey) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative z-10 w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white truncate pr-4">
            {movie.title} ({movie.year})
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close trailer"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Video Container */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-900 shadow-2xl">
          <iframe
            src={`https://www.youtube.com/embed/${movie.trailerKey}?rel=0&modestbranding=1`}
            title={`${movie.title} Trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Action Buttons */}
        {showActions && (onLike || onPass) && (
          <div className="flex items-center justify-center gap-6 mt-6">
            {onPass && (
              <button
                onClick={() => {
                  onPass();
                  onClose();
                }}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl',
                  'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50',
                  'text-red-400 font-semibold transition-all',
                  'hover:scale-105 active:scale-95'
                )}
              >
                <ThumbsDown className="w-5 h-5" />
                Pass
              </button>
            )}
            {onLike && (
              <button
                onClick={() => {
                  onLike();
                  onClose();
                }}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl',
                  'bg-green-500/20 hover:bg-green-500/30 border border-green-500/50',
                  'text-green-400 font-semibold transition-all',
                  'hover:scale-105 active:scale-95'
                )}
              >
                <ThumbsUp className="w-5 h-5" />
                Like
              </button>
            )}
          </div>
        )}

        {/* Close hint */}
        <p className="text-center text-gray-500 text-sm mt-4">
          Press ESC or click outside to close
        </p>
      </div>
    </div>
  );
}
