'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Search, Trash2, Plus, Film } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import WatchHistoryList from '@/components/history/WatchHistoryList';
import ImportModal from '@/components/history/ImportModal';
import { useUserStore } from '@/store/userStore';
import { useMovieStore } from '@/store/movieStore';
import { WatchHistoryEntry } from '@/lib/types';
import { getTMDBImageUrl } from '@/lib/utils';
import Image from 'next/image';

export default function HistoryPage() {
  const router = useRouter();
  const { user, addToWatchHistory, importWatchHistory, clearWatchHistory } = useUserStore();
  const { movies, searchMovies, getMovieById } = useMovieStore();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Enrich history entries with movie data
  const enrichedHistory = useMemo(() => {
    if (!user) return [];
    return user.watchHistory.map((entry) => ({
      ...entry,
      movie: getMovieById(entry.movieId),
    }));
  }, [user, getMovieById]);

  // Search results for add modal
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchMovies(searchQuery).slice(0, 10);
  }, [searchQuery, searchMovies]);

  const handleImport = (entries: WatchHistoryEntry[]) => {
    importWatchHistory(entries);
  };

  const handleAddMovie = (movieId: number) => {
    addToWatchHistory({
      movieId,
      source: 'manual',
    });
    setShowAddModal(false);
    setSearchQuery('');
  };

  const handleClearHistory = () => {
    clearWatchHistory();
    setShowClearModal(false);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h1 className="font-semibold text-white">Watch History</h1>
                <p className="text-sm text-gray-400">
                  {user?.watchHistory.length || 0} movies tracked
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowImportModal(true)}
              >
                <Upload className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Info Card */}
        <Card variant="glass" padding="md" className="mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <Film className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">
                Why track watch history?
              </h3>
              <p className="text-gray-400 text-sm">
                AI will automatically skip movies you&apos;ve already watched,
                so you only see fresh recommendations in your sessions.
              </p>
            </div>
          </div>
        </Card>

        {/* Watch History List */}
        <WatchHistoryList entries={enrichedHistory} />

        {/* Clear History Button */}
        {user && user.watchHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 pt-6 border-t border-gray-800"
          >
            <Button
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => setShowClearModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All History
            </Button>
          </motion.div>
        )}
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />

      {/* Add Movie Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSearchQuery('');
        }}
        title="Mark as Watched"
        size="lg"
      >
        <Input
          placeholder="Search for a movie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          autoFocus
        />

        <div className="mt-4 max-h-[400px] overflow-y-auto space-y-2">
          {searchQuery && searchResults.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No movies found matching &quot;{searchQuery}&quot;
            </p>
          )}

          {searchResults.map((movie) => {
            const isWatched = user?.watchHistory.some(
              (e) => e.movieId === movie.id
            );

            return (
              <button
                key={movie.id}
                onClick={() => !isWatched && handleAddMovie(movie.id)}
                disabled={isWatched}
                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors text-left ${
                  isWatched
                    ? 'opacity-50 cursor-not-allowed bg-gray-800/50'
                    : 'hover:bg-gray-800'
                }`}
              >
                <div className="relative w-10 h-15 flex-shrink-0 rounded overflow-hidden">
                  <Image
                    src={getTMDBImageUrl(movie.posterPath, 'w185')}
                    alt={movie.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">
                    {movie.title}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {movie.year} • {movie.genres.slice(0, 2).join(', ')}
                  </p>
                </div>
                {isWatched && (
                  <span className="text-xs text-gray-500">Already added</span>
                )}
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Watch History?"
        size="sm"
      >
        <p className="text-gray-400 mb-6">
          This will remove all {user?.watchHistory.length} movies from your
          watch history. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowClearModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={handleClearHistory}
          >
            Clear All
          </Button>
        </div>
      </Modal>
    </div>
  );
}
