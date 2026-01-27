'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Star, Clock, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { Movie } from '@/lib/types';
import { getTMDBImageUrl, formatRuntime, getMoodEmoji, getMoodColor, getGenreColor } from '@/lib/utils';
import Badge from '@/components/ui/Badge';

interface MovieCardProps {
  movie: Movie;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  onPlayTrailer?: () => void;
}

export default function MovieCard({ movie, showDetails = false, onToggleDetails, onPlayTrailer }: MovieCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-gray-900">
      {/* Poster Image */}
      <div className="absolute inset-0">
        {imageError ? (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gray-700 flex items-center justify-center">
                <Play className="w-8 h-8" />
              </div>
              <p className="text-sm">No Poster</p>
            </div>
          </div>
        ) : (
          <Image
            src={getTMDBImageUrl(movie.posterPath, 'w780')}
            alt={movie.title}
            fill
            className={`object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            priority
          />
        )}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse" />
        )}
      </div>

      {/* Play Button Overlay */}
      {movie.trailerKey && onPlayTrailer && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayTrailer();
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10
            w-20 h-20 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm
            flex items-center justify-center transition-all duration-200
            hover:scale-110 active:scale-95 group"
          aria-label="Play trailer"
        >
          <Play className="w-10 h-10 text-white fill-white ml-1 group-hover:text-primary-400 group-hover:fill-primary-400 transition-colors" />
        </button>
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        {/* Rating Badge */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="success" size="sm">
            <Star className="w-3 h-3 mr-1 fill-current" />
            {movie.voteAverage.toFixed(1)}
          </Badge>
          <Badge variant="default" size="sm">
            <Clock className="w-3 h-3 mr-1" />
            {formatRuntime(movie.runtime)}
          </Badge>
        </div>

        {/* Title and Year */}
        <h2 className="text-2xl font-bold text-white text-shadow-lg mb-1">
          {movie.title}
        </h2>
        <p className="text-gray-300 text-sm mb-3">{movie.year}</p>

        {/* Genres */}
        <div className="flex flex-wrap gap-2 mb-3">
          {movie.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              className={`${getGenreColor(genre)} text-white text-xs px-2 py-1 rounded-full`}
            >
              {genre}
            </span>
          ))}
        </div>

        {/* Mood Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {movie.moodTags.slice(0, 3).map((mood) => (
            <span
              key={mood}
              className={`${getMoodColor(mood)} text-white text-xs px-2 py-1 rounded-full flex items-center gap-1`}
            >
              {getMoodEmoji(mood)} {mood}
            </span>
          ))}
        </div>

        {/* Expandable Details */}
        {onToggleDetails && (
          <button
            onClick={onToggleDetails}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span className="text-sm">Less info</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span className="text-sm">More info</span>
              </>
            )}
          </button>
        )}

        {/* Extended Details */}
        <motion.div
          initial={false}
          animate={{ height: showDetails ? 'auto' : 0, opacity: showDetails ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="pt-4 border-t border-gray-700 mt-4">
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              {movie.overview}
            </p>
            <p className="text-primary-400 text-sm italic">
              {movie.goodFor}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Swipe Hints (shown during drag) */}
      <div className="swipe-hint swipe-hint-like">LIKE</div>
      <div className="swipe-hint swipe-hint-pass">PASS</div>
    </div>
  );
}
