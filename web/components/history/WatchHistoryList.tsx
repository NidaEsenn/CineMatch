'use client';

import Image from 'next/image';
import { Trash2, Calendar, Star } from 'lucide-react';
import { WatchHistoryEntry, Movie } from '@/lib/types';
import { getTMDBImageUrl, formatRuntime } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface WatchHistoryListProps {
  entries: (WatchHistoryEntry & { movie?: Movie })[];
  onRemove?: (movieId: number) => void;
}

export default function WatchHistoryList({
  entries,
  onRemove,
}: WatchHistoryListProps) {
  if (entries.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center">
        <div className="text-5xl mb-4">📺</div>
        <h3 className="text-lg font-semibold text-white mb-2">
          No Watch History
        </h3>
        <p className="text-gray-400 text-sm">
          Import your watch history or mark movies as watched to help AI give
          better recommendations.
        </p>
      </Card>
    );
  }

  const sourceLabels: Record<string, { label: string; color: string }> = {
    netflix: { label: 'Netflix', color: 'bg-red-500' },
    prime: { label: 'Prime', color: 'bg-blue-500' },
    disney: { label: 'Disney+', color: 'bg-blue-700' },
    letterboxd: { label: 'Letterboxd', color: 'bg-green-500' },
    manual: { label: 'Manual', color: 'bg-gray-500' },
  };

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.movieId} variant="default" padding="sm">
          <div className="flex gap-4">
            {/* Poster */}
            {entry.movie && (
              <div className="relative w-12 h-18 flex-shrink-0 rounded-lg overflow-hidden">
                <Image
                  src={getTMDBImageUrl(entry.movie.posterPath, 'w185')}
                  alt={entry.movie.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-white truncate">
                    {entry.movie?.title || `Movie #${entry.movieId}`}
                  </h4>
                  {entry.movie && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <span>{entry.movie.year}</span>
                      {entry.movie.voteAverage && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          {entry.movie.voteAverage.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {onRemove && (
                  <button
                    onClick={() => onRemove(entry.movieId)}
                    className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="default"
                  size="sm"
                  className={sourceLabels[entry.source]?.color}
                >
                  {sourceLabels[entry.source]?.label || entry.source}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {new Date(entry.watchedAt).toLocaleDateString()}
                </span>
                {entry.rating && (
                  <span className="flex items-center gap-1 text-xs text-yellow-400">
                    <Star className="w-3 h-3 fill-current" />
                    {entry.rating}/10
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
