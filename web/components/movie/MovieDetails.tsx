'use client';

import Image from 'next/image';
import { Star, Clock, Calendar, Film } from 'lucide-react';
import { Movie } from '@/lib/types';
import { getTMDBImageUrl, formatRuntime, getMoodEmoji, getMoodColor, getGenreColor } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';

interface MovieDetailsProps {
  movie: Movie;
  aiExplanation?: string;
  matchPercentage?: number;
}

export default function MovieDetails({
  movie,
  aiExplanation,
  matchPercentage,
}: MovieDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Header with Poster */}
      <div className="flex gap-4">
        <div className="relative w-32 h-48 flex-shrink-0 rounded-lg overflow-hidden">
          <Image
            src={getTMDBImageUrl(movie.posterPath, 'w342')}
            alt={movie.title}
            fill
            className="object-cover"
          />
        </div>

        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-1">{movie.title}</h2>
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
            <Calendar className="w-4 h-4" />
            <span>{movie.year}</span>
            <span className="text-gray-600">•</span>
            <Clock className="w-4 h-4" />
            <span>{formatRuntime(movie.runtime)}</span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="success">
              <Star className="w-4 h-4 mr-1 fill-current" />
              {movie.voteAverage.toFixed(1)}
            </Badge>
            {matchPercentage !== undefined && (
              <Badge variant="info">
                {matchPercentage}% Match
              </Badge>
            )}
          </div>

          {/* Genres */}
          <div className="flex flex-wrap gap-2">
            {movie.genres.map((genre) => (
              <span
                key={genre}
                className={`${getGenreColor(genre)} text-white text-xs px-2 py-1 rounded-full`}
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* AI Explanation */}
      {aiExplanation && (
        <Card variant="glass" padding="md">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <Film className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-primary-400 mb-1">
                Why this movie?
              </h4>
              <p className="text-gray-300 text-sm">{aiExplanation}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Overview */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Overview</h3>
        <p className="text-gray-300 leading-relaxed">{movie.overview}</p>
      </div>

      {/* Mood Tags */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Mood</h3>
        <div className="flex flex-wrap gap-2">
          {movie.moodTags.map((mood) => (
            <span
              key={mood}
              className={`${getMoodColor(mood)} text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5`}
            >
              {getMoodEmoji(mood)} {mood}
            </span>
          ))}
        </div>
      </div>

      {/* Good For */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Perfect for</h3>
        <p className="text-gray-300 italic">&quot;{movie.goodFor}&quot;</p>
      </div>

      {/* Emotional Profile */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Emotional Profile</h3>
        <div className="space-y-2">
          {Object.entries(movie.emotionalProfile).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-gray-400 text-sm capitalize w-28">{key}</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                  style={{ width: `${value * 100}%` }}
                />
              </div>
              <span className="text-gray-400 text-sm w-10">
                {Math.round(value * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
