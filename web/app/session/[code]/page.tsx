'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Share2, LogOut, Trophy, Sparkles } from 'lucide-react';
import SwipeStack from '@/components/movie/SwipeStack';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import MovieDetails from '@/components/movie/MovieDetails';
import AIExplanation from '@/components/ai/AIExplanation';
import ConflictBanner from '@/components/ai/ConflictBanner';
import { useSessionStore } from '@/store/sessionStore';
import { useMovieStore } from '@/store/movieStore';
import { useUserStore } from '@/store/userStore';
import { Match, SwipeAction, Movie } from '@/lib/types';
import { formatSessionCode } from '@/lib/utils';
import { generateMovieExplanation } from '@/data/mockAI';
import { subscribeToSession, FirebaseSession, recordSwipe as firebaseRecordSwipe, getFirebaseSession } from '@/lib/firebase';
import { recordSwipeToBackend } from '@/lib/api';

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const { currentSession, recordSwipe, undoSwipe, leaveSession, startSession } = useSessionStore();
  const { getMoviesByIds, getMovieById, setAiMovies } = useMovieStore();
  const { user } = useUserStore();

  const [showMatchModal, setShowMatchModal] = useState(false);
  const [latestMatch, setLatestMatch] = useState<Match | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [firebaseSession, setFirebaseSession] = useState<FirebaseSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Get movies for the session - prefer Firebase movieIds over localStorage
  const movieIds = firebaseSession?.movieIds || currentSession?.movieStack || [];
  const movies = getMoviesByIds(movieIds);

  // Subscribe to Firebase session for realtime updates
  useEffect(() => {
    if (!code) return;

    setIsLoadingSession(true);

    // Initial fetch
    getFirebaseSession(code).then((session) => {
      if (session) {
        setFirebaseSession(session);
        // Load movies from Firebase - ensures all users have same movies
        if (session.movies && session.movieIds) {
          // Use movieIds to preserve order (same for all users)
          const firebaseMovies: Movie[] = session.movieIds
            .map(id => session.movies?.[id])
            .filter(Boolean)
            .map((m: any) => ({
              id: m.id,
              tmdbId: m.id,
              title: m.title,
              year: 2024,
              genres: m.genres || [],
              overview: m.overview,
              posterPath: m.posterPath,
              voteAverage: m.voteAverage || 0,
              runtime: 120,
              moodTags: [],
              emotionalProfile: { tension: 0.5, humor: 0.5, romance: 0.5, action: 0.5, thoughtfulness: 0.5 },
              goodFor: m.why,
              trailerKey: m.trailerKey || undefined,
            }));
          // Store Firebase movies to ensure consistency across all users
          setAiMovies(firebaseMovies);
        }
      }
      setIsLoadingSession(false);
    });

    // Subscribe to realtime updates
    const unsubscribe = subscribeToSession(code, (session) => {
      setFirebaseSession(session);

      // CRITICAL: Also update movies when Firebase session changes
      // This ensures all users see new movies when "Show 10 More Movies" is clicked
      if (session?.movies && session?.movieIds) {
        const firebaseMovies: Movie[] = session.movieIds
          .map(id => session.movies?.[id])
          .filter(Boolean)
          .map((m: any) => ({
            id: m.id,
            tmdbId: m.id,
            title: m.title,
            year: 2024,
            genres: m.genres || [],
            overview: m.overview,
            posterPath: m.posterPath,
            voteAverage: m.voteAverage || 0,
            runtime: 120,
            moodTags: [],
            emotionalProfile: { tension: 0.5, humor: 0.5, romance: 0.5, action: 0.5, thoughtfulness: 0.5 },
            goodFor: m.why,
            trailerKey: m.trailerKey || undefined,
          }));
        setAiMovies(firebaseMovies);
      }
    });

    return () => unsubscribe();
  }, [code, setAiMovies]);

  // Handle swipe
  const handleSwipe = useCallback(async (movieId: number, action: SwipeAction) => {
    // Record in local store (for UI state only)
    recordSwipe(movieId, action);

    // Record in Firebase for realtime sync
    const odIds = user?.id || user?.name || 'anonymous';
    const userName = user?.name || 'anonymous';
    const firebaseAction = action === 'LIKE' ? 'like' : action === 'SUPER_LIKE' ? 'super_like' : 'dislike';
    await firebaseRecordSwipe(code, odIds, movieId, firebaseAction);

    // Record in Python backend for feedback learning and match calculation
    const backendAction = action === 'LIKE' || action === 'SUPER_LIKE' ? 'like' : 'dislike';
    try {
      const result = await recordSwipeToBackend(code, userName, movieId, backendAction);
      console.log(`[CineMatch] Swipe recorded:`, {
        session_id: code,
        user: userName,
        movie_id: movieId,
        action: backendAction,
        total_swipes: result.total_swipes,
        feedback_ready: result.feedback_ready,
      });
    } catch (error) {
      console.error('Failed to record swipe to backend:', error);
      // Don't block the UI if backend fails
    }

    // NOTE: Match detection is now done on the Results page via backend API
    // Local match detection is disabled because each browser has isolated state
    // Go to Results page to see matches calculated from all users' swipes
  }, [recordSwipe, code, user]);

  // Handle undo
  const handleUndo = useCallback(() => {
    undoSwipe();
  }, [undoSwipe]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showMatchModal) return;

      // Get current movie index from swipe data
      const swipedCount = currentSession
        ? Object.keys(currentSession.swipeData).filter(
            (movieId) =>
              currentSession.swipeData[parseInt(movieId)]?.[
                currentSession.participants[0]?.userId
              ]
          ).length
        : 0;

      const currentMovie = movies[swipedCount];
      if (!currentMovie) return;

      if (e.key === 'ArrowRight') {
        handleSwipe(currentMovie.id, 'LIKE');
      } else if (e.key === 'ArrowLeft') {
        handleSwipe(currentMovie.id, 'PASS');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSession, movies, showMatchModal, handleSwipe]);

  // Redirect if no session
  useEffect(() => {
    if (!currentSession || currentSession.code !== code) {
      router.push(`/session/join?code=${code}`);
    } else if (currentSession.status === 'WAITING') {
      startSession();
    }
  }, [currentSession, code, router, startSession]);

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading session...</div>
      </div>
    );
  }

  const matchedMovie = latestMatch ? getMovieById(latestMatch.movieId) : null;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Session Info */}
            <div className="flex items-center gap-3">
              <div className="text-sm">
                <p className="text-gray-400">Session</p>
                <p className="font-mono font-semibold text-white">
                  {formatSessionCode(currentSession.code)}
                </p>
              </div>
            </div>

            {/* Participants */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white">
                  {firebaseSession?.participants
                    ? Object.keys(firebaseSession.participants).length
                    : currentSession.participants.length}
                </span>
              </div>

              {/* Results Button - always show so users can check backend matches */}
              <button
                onClick={() => router.push(`/results/${code}`)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-500/20 text-primary-400 rounded-full hover:bg-primary-500/30 transition-colors"
              >
                <Trophy className="w-4 h-4" />
                <span className="text-sm">Results</span>
              </button>

              {/* Menu */}
              <button
                onClick={() => setShowLeaveModal(true)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-6">
        {/* AI Explanation */}
        {currentSession.aiPreferences && (
          <div className="mb-6">
            <AIExplanation
              explanation={currentSession.aiPreferences.explanation}
              conflicts={currentSession.aiPreferences.conflicts}
            />
          </div>
        )}

        {/* Conflict Banner */}
        {currentSession.aiPreferences?.conflicts && (
          <ConflictBanner conflicts={currentSession.aiPreferences.conflicts} />
        )}

        {/* Participant Status */}
        <Card variant="default" padding="sm" className="mb-6">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
            {/* Show Firebase participants if available, otherwise local */}
            {firebaseSession?.participants
              ? Object.values(firebaseSession.participants).map((p) => {
                  const swipedCount = p.swipes ? Object.keys(p.swipes).length : 0;
                  const totalMovies = firebaseSession.movieIds?.length || currentSession.movieStack.length;
                  const isCurrentUser = p.id === user?.id || p.name === user?.name;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                        isCurrentUser ? 'bg-primary-500/20 text-primary-400' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs opacity-70">
                        {swipedCount}/{totalMovies}
                      </span>
                    </div>
                  );
                })
              : currentSession.participants.map((p) => {
                  const swipedCount = Object.keys(currentSession.swipeData).filter(
                    (movieId) =>
                      currentSession.swipeData[parseInt(movieId)]?.[p.userId]
                  ).length;
                  const isCurrentUser = p.userId === user?.id || p.name === user?.name;

                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                        isCurrentUser ? 'bg-primary-500/20 text-primary-400' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs opacity-70">
                        {swipedCount}/{currentSession.movieStack.length}
                      </span>
                    </div>
                  );
                })}
          </div>
        </Card>

        {/* Swipe Stack */}
        <SwipeStack
          movies={movies}
          onSwipe={handleSwipe}
          onUndo={handleUndo}
          canUndo={true}
          onComplete={() => router.push(`/results/${code}`)}
        />
      </main>

      {/* Match Modal */}
      <AnimatePresence>
        {showMatchModal && matchedMovie && (
          <Modal
            isOpen={showMatchModal}
            onClose={() => setShowMatchModal(false)}
            size="lg"
          >
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10 }}
                className="w-20 h-20 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Trophy className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">
                It&apos;s a Match!
              </h2>
              <p className="text-gray-400">
                Everyone agreed on this movie
              </p>
            </div>

            <MovieDetails
              movie={matchedMovie}
              aiExplanation={generateMovieExplanation(
                matchedMovie,
                currentSession.participants.map((p) => ({
                  name: p.name,
                  moods: p.moods,
                }))
              )}
              matchPercentage={latestMatch?.matchPercentage}
            />

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowMatchModal(false)}
              >
                Keep Swiping
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push(`/results/${code}`)}
              >
                View All Matches
              </Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Leave Session Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Leave Session?"
        size="sm"
      >
        <p className="text-gray-400 mb-6">
          Are you sure you want to leave this session? You can rejoin later with
          the same code.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowLeaveModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              leaveSession();
              router.push('/');
            }}
          >
            Leave
          </Button>
        </div>
      </Modal>
    </div>
  );
}
