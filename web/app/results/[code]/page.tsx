'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, Trophy, Star, Clock, Play, ExternalLink, RefreshCw, Sparkles, Heart, X, SkipForward, Users } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useSessionStore } from '@/store/sessionStore';
import { useMovieStore } from '@/store/movieStore';
import { getTMDBImageUrl, formatRuntime } from '@/lib/utils';
import { getRecommendations, getMatches, MovieMatch, MatchesResponse } from '@/lib/api';
import { updateSessionWithMovies } from '@/lib/firebase';
import { Movie } from '@/lib/types';

// Vote icon component
function VoteIcon({ action }: { action: string }) {
  switch (action) {
    case 'like':
      return <Heart className="w-3 h-3 text-green-400 fill-current" />;
    case 'dislike':
      return <X className="w-3 h-3 text-red-400" />;
    case 'skip':
      return <SkipForward className="w-3 h-3 text-gray-400" />;
    default:
      return null;
  }
}

// Match card component
function MatchCard({ match, isPerfect }: { match: MovieMatch; isPerfect: boolean }) {
  const router = useRouter();

  return (
    <Card variant={isPerfect ? 'gradient' : 'default'} padding="sm">
      <div className="flex gap-4">
        {/* Poster */}
        <div className="relative w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden">
          {match.poster_url ? (
            <Image
              src={match.poster_url}
              alt={match.title || 'Movie'}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
              <span className="text-2xl">🎬</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-white truncate">
              {match.title || `Movie #${match.movie_id}`}
            </h4>
            <Badge
              variant={isPerfect ? 'success' : 'info'}
              size="sm"
            >
              {match.match_percentage}%
            </Badge>
          </div>

          {/* Movie details */}
          {match.vote_average && (
            <div className="flex items-center gap-3 text-gray-400 text-sm mt-1">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                {match.vote_average.toFixed(1)}
              </span>
              {match.genres && match.genres.length > 0 && (
                <span>{match.genres.slice(0, 2).join(', ')}</span>
              )}
            </div>
          )}

          {/* Vote breakdown */}
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(match.votes).map(([userName, action]) => (
              <div
                key={userName}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  action === 'like'
                    ? 'bg-green-500/20 text-green-300'
                    : action === 'dislike'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                <VoteIcon action={action} />
                <span>{userName}</span>
              </div>
            ))}
          </div>

          {/* Match summary */}
          {!isPerfect && match.liked_count !== undefined && (
            <p className="text-gray-500 text-xs mt-2">
              {match.liked_count} of {match.total_voters} liked
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const { currentSession, setMovieStack } = useSessionStore();
  const { setAiMovies } = useMovieStore();

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [round, setRound] = useState(1);
  const [backendMatches, setBackendMatches] = useState<MatchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch matches function (reusable)
  const fetchMatches = useCallback(async (showLoading = true) => {
    if (!code) return;

    if (showLoading) {
      setIsLoadingMatches(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const matches = await getMatches(code);
      setBackendMatches(matches);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch matches:', err);
      setError('Failed to load matches from server.');
    } finally {
      setIsLoadingMatches(false);
      setIsRefreshing(false);
    }
  }, [code]);

  // Fetch matches on mount
  useEffect(() => {
    fetchMatches(true);
  }, [fetchMatches]);

  // Auto-refresh every 5 seconds to catch new matches from other users
  useEffect(() => {
    if (!code) return;

    const interval = setInterval(() => {
      fetchMatches(false); // Silent refresh (no loading spinner)
    }, 5000);

    return () => clearInterval(interval);
  }, [code, fetchMatches]);

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Session not found</p>
          <Button onClick={() => router.push('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const perfectMatches = backendMatches?.matches.perfect || [];
  const majorityMatches = backendMatches?.matches.majority || [];
  const totalMatches = perfectMatches.length + majorityMatches.length;
  const userCount = backendMatches?.user_count || currentSession.participants.length;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/session/${code}`)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h1 className="font-semibold text-white">Session Results</h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{userCount} participants</span>
                  <span>•</span>
                  <span>{totalMatches} match{totalMatches !== 1 ? 'es' : ''}</span>
                </div>
              </div>
            </div>
            {/* Refresh Button */}
            <button
              onClick={() => fetchMatches(false)}
              disabled={isRefreshing}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh matches"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Auto-refresh indicator */}
          {lastUpdated && (
            <div className="mt-1 text-xs text-gray-500 text-center">
              Auto-refreshing • Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {isLoadingMatches ? (
          <Card variant="glass" padding="lg" className="text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading matches...</p>
          </Card>
        ) : error ? (
          <Card variant="glass" padding="lg" className="text-center mb-6">
            <p className="text-yellow-400 mb-2">{error}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        ) : totalMatches === 0 ? (
          <Card variant="glass" padding="lg" className="text-center">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-xl font-semibold text-white mb-2">
              No Matches Yet
            </h2>
            <p className="text-gray-400 mb-6">
              Keep swiping to find movies everyone agrees on!
            </p>
            <Button onClick={() => router.push(`/session/${code}`)}>
              Continue Swiping
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Perfect Matches */}
            {perfectMatches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-lg font-semibold text-white">
                    Perfect Matches
                  </h2>
                  <Badge variant="success" size="sm">
                    Everyone loved these!
                  </Badge>
                </div>

                <div className="space-y-3">
                  {perfectMatches.map((match, index) => (
                    <motion.div
                      key={match.movie_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <MatchCard match={match} isPerfect={true} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Majority Matches */}
            {majorityMatches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: perfectMatches.length * 0.1 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">
                    Majority Matches
                  </h2>
                  <Badge variant="info" size="sm">
                    Most liked these
                  </Badge>
                </div>

                <div className="space-y-3">
                  {majorityMatches.map((match, index) => (
                    <motion.div
                      key={match.movie_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (perfectMatches.length + index) * 0.1 }}
                    >
                      <MatchCard match={match} isPerfect={false} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Stats Summary */}
            {backendMatches && backendMatches.no_match_count > 0 && (
              <Card variant="glass" padding="sm">
                <p className="text-gray-400 text-sm text-center">
                  {backendMatches.no_match_count} movie{backendMatches.no_match_count !== 1 ? 's' : ''} didn't match (vetoed or not enough votes)
                </p>
              </Card>
            )}

            {/* 10 More Movies Section */}
            <Card variant="glass" padding="md" className="text-center">
              <div className="flex flex-col items-center">
                <Sparkles className="w-8 h-8 text-primary-400 mb-3" />
                <p className="text-gray-400 mb-1">
                  Not feeling these? We learn from your swipes!
                </p>
                <p className="text-gray-500 text-sm mb-4">
                  {round > 1 && `Round ${round} - Personalized based on your swipes`}
                </p>
                <Button
                  onClick={handleGetMoreMovies}
                  disabled={isLoadingMore}
                  className="w-full"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Show 10 More Movies
                    </>
                  )}
                </Button>
                <p className="text-gray-500 text-xs mt-2">
                  Our AI will use your likes/dislikes to find better matches
                </p>
              </div>
            </Card>

            {/* Continue Button */}
            <div className="pt-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => router.push(`/session/${code}`)}
              >
                Continue Swiping
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  // Handler for "10 More Movies" button
  async function handleGetMoreMovies() {
    if (!currentSession) return;

    setIsLoadingMore(true);

    try {
      // Build participants from session
      const participants = currentSession.participants.map((p) => ({
        name: p.name,
        moods: p.moods,
        note: p.preferenceNote || null,
      }));

      // Get new recommendations with feedback
      const nextRound = round + 1;
      const response = await getRecommendations(
        participants,
        10,
        code, // session_id
        nextRound
      );

      // Log feedback info for debugging
      console.log(`[CineMatch] Round ${nextRound} recommendations:`, {
        seen_count: response.seen_count,
        feedback_applied: response.feedback_applied,
        model_used: response.model_used,
        movie_count: response.recommendations.length,
      });

      // Convert API movies to app Movie type
      const newMovies: Movie[] = response.recommendations.map((m) => ({
        id: m.id,
        tmdbId: m.id,
        title: m.title,
        year: parseInt(m.release_year || '2024') || 2024,
        genres: m.genres || [],
        overview: m.overview || '',
        posterPath: m.poster_url?.replace('https://image.tmdb.org/t/p/w500', '') || '',
        voteAverage: m.vote_average || 0,
        runtime: 120,
        moodTags: [],
        emotionalProfile: { tension: 0.5, humor: 0.5, romance: 0.5, action: 0.5, thoughtfulness: 0.5 },
        goodFor: m.why,
        trailerKey: m.trailer_key || undefined,
      }));

      // Update local stores
      setAiMovies(newMovies);
      setMovieStack(newMovies.map((m) => m.id));
      setRound(nextRound);

      // CRITICAL: Also update Firebase so other users see the new movies
      try {
        await updateSessionWithMovies(
          code,
          newMovies.map((m) => m.id),
          newMovies,
          response.model_used
        );
        console.log('[CineMatch] Firebase updated with new movies');
      } catch (fbError) {
        console.error('[CineMatch] Failed to update Firebase:', fbError);
        // Don't block the flow if Firebase fails - local user can still swipe
      }

      // Navigate to swipe screen
      router.push(`/session/${code}`);
    } catch (error) {
      console.error('Failed to get more movies:', error);
      alert('Failed to get more movies. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }
}
