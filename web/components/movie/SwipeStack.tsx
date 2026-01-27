'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Heart, X, RotateCcw, Info, Play } from 'lucide-react';
import { Movie, SwipeAction } from '@/lib/types';
import MovieCard from './MovieCard';
import TrailerModal from './TrailerModal';
import Button from '@/components/ui/Button';

interface SwipeStackProps {
  movies: Movie[];
  onSwipe: (movieId: number, action: SwipeAction) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onComplete?: () => void;  // Called when all movies have been swiped
}

export default function SwipeStack({
  movies,
  onSwipe,
  onUndo,
  canUndo = false,
  onComplete,
}: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  // Track the first movie ID to detect when movie list changes
  const firstMovieId = movies[0]?.id;

  // Reset index when movie list changes (e.g., "Show 10 More Movies")
  useEffect(() => {
    setCurrentIndex(0);
    setShowDetails(false);
  }, [firstMovieId]);

  const currentMovie = movies[currentIndex];
  const nextMovie = movies[currentIndex + 1];

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 100;
      const velocity = info.velocity.x;
      const offset = info.offset.x;

      if (offset > threshold || velocity > 500) {
        setExitDirection('right');
        onSwipe(currentMovie.id, 'LIKE');
        setTimeout(() => {
          setCurrentIndex((i) => i + 1);
          setExitDirection(null);
          setShowDetails(false);
        }, 200);
      } else if (offset < -threshold || velocity < -500) {
        setExitDirection('left');
        onSwipe(currentMovie.id, 'PASS');
        setTimeout(() => {
          setCurrentIndex((i) => i + 1);
          setExitDirection(null);
          setShowDetails(false);
        }, 200);
      }
    },
    [currentMovie, onSwipe]
  );

  const handleButtonSwipe = useCallback(
    (action: SwipeAction) => {
      setExitDirection(action === 'LIKE' ? 'right' : 'left');
      onSwipe(currentMovie.id, action);
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setExitDirection(null);
        setShowDetails(false);
      }, 200);
    },
    [currentMovie, onSwipe]
  );

  const handleUndo = useCallback(() => {
    if (onUndo && currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      onUndo();
    }
  }, [onUndo, currentIndex]);

  // Auto-navigate to results when all movies are swiped
  useEffect(() => {
    if (!currentMovie && movies.length > 0 && onComplete) {
      // Small delay to let the last swipe animation complete
      const timer = setTimeout(() => {
        onComplete();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentMovie, movies.length, onComplete]);

  if (!currentMovie) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-6xl mb-4">🎬</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          All done!
        </h3>
        <p className="text-gray-400">
          Redirecting to results...
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{currentIndex + 1} of {movies.length}</span>
          <span>{movies.length - currentIndex - 1} remaining</span>
        </div>
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / movies.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card Stack */}
      <div className="relative aspect-[2/3] mb-6">
        {/* Next card (behind) */}
        {nextMovie && (
          <div className="absolute inset-0 scale-95 opacity-50">
            <MovieCard movie={nextMovie} />
          </div>
        )}

        {/* Current card */}
        <motion.div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{ x, rotate }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={handleDragEnd}
          animate={
            exitDirection === 'right'
              ? { x: 500, rotate: 20, opacity: 0 }
              : exitDirection === 'left'
              ? { x: -500, rotate: -20, opacity: 0 }
              : { x: 0, rotate: 0, opacity: 1 }
          }
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          {/* Like indicator */}
          <motion.div
            className="absolute top-8 right-8 z-10 bg-green-500 text-white font-bold text-2xl px-4 py-2 rounded-lg border-4 border-green-400 rotate-12"
            style={{ opacity: likeOpacity }}
          >
            LIKE
          </motion.div>

          {/* Pass indicator */}
          <motion.div
            className="absolute top-8 left-8 z-10 bg-red-500 text-white font-bold text-2xl px-4 py-2 rounded-lg border-4 border-red-400 -rotate-12"
            style={{ opacity: passOpacity }}
          >
            NOPE
          </motion.div>

          <MovieCard
            movie={currentMovie}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails(!showDetails)}
            onPlayTrailer={() => setShowTrailer(true)}
          />
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-4">
        {/* Undo Button */}
        <button
          onClick={handleUndo}
          disabled={!canUndo || currentIndex === 0}
          className="p-3 rounded-full bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Pass Button */}
        <button
          onClick={() => handleButtonSwipe('PASS')}
          className="p-5 rounded-full bg-gray-800 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg hover:shadow-red-500/25"
        >
          <X className="w-8 h-8" />
        </button>

        {/* Trailer Button */}
        {currentMovie.trailerKey && (
          <button
            onClick={() => setShowTrailer(true)}
            className="p-3 rounded-full bg-gray-800 border border-primary-500 text-primary-400 hover:bg-primary-500 hover:text-white transition-all"
          >
            <Play className="w-5 h-5" />
          </button>
        )}

        {/* Info Button */}
        {!currentMovie.trailerKey && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-3 rounded-full bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
          >
            <Info className="w-5 h-5" />
          </button>
        )}

        {/* Like Button */}
        <button
          onClick={() => handleButtonSwipe('LIKE')}
          className="p-5 rounded-full bg-gray-800 border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all shadow-lg hover:shadow-green-500/25"
        >
          <Heart className="w-8 h-8" />
        </button>

        {/* Info Button (when trailer exists) */}
        {currentMovie.trailerKey && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-3 rounded-full bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
          >
            <Info className="w-5 h-5" />
          </button>
        )}

        {/* Placeholder for symmetry */}
        {!currentMovie.trailerKey && <div className="w-11" />}
      </div>

      {/* Trailer Modal */}
      <TrailerModal
        movie={currentMovie}
        isOpen={showTrailer}
        onClose={() => setShowTrailer(false)}
        onLike={() => handleButtonSwipe('LIKE')}
        onPass={() => handleButtonSwipe('PASS')}
        showActions
      />

      {/* Keyboard hints */}
      <p className="text-center text-gray-500 text-sm mt-4">
        Swipe or use <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400">←</kbd> <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400">→</kbd> keys
      </p>
    </div>
  );
}
