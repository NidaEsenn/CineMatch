'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Copy, Check, Users, Share2, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PreferenceChat from '@/components/ai/PreferenceChat';
import WaitingRoom from '@/components/session/WaitingRoom';
import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { useMovieStore } from '@/store/movieStore';
import { MoodTag, Movie } from '@/lib/types';
import { formatSessionCode, generateSessionCode } from '@/lib/utils';
import { getRecommendations, MovieRecommendation } from '@/lib/api';
import {
  createWaitingSession,
  updateParticipantPreferences,
  updateSessionWithMovies,
  subscribeToSession,
  getAllParticipantsPreferences,
  FirebaseSession,
} from '@/lib/firebase';

type Step = 'name' | 'code' | 'mood' | 'waiting' | 'loading';

export default function CreateSessionPage() {
  const router = useRouter();
  const { createSessionWithMovies, chatMessages, addChatMessage, clearChatMessages } = useSessionStore();
  const { user, setUser } = useUserStore();
  const { setAiMovies } = useMovieStore();

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(user?.name || '');
  const [selectedMoods, setSelectedMoods] = useState<MoodTag[]>([]);
  const [copied, setCopied] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [firebaseSession, setFirebaseSession] = useState<FirebaseSession | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  // Store the participant ID used when creating the session - ensures consistency
  const [participantId, setParticipantId] = useState<string | null>(null);

  // Use the stored participantId, or fall back to user.id or name
  const userId = participantId || user?.id || name;

  // Extract preference note from chat messages
  const preferenceNote = chatMessages
    .filter((m) => m.participantId === userId && (m.type === 'text' || m.type === 'voice'))
    .map((m) => m.text)
    .filter(Boolean)
    .join('. ');

  // Use ref to access current values in callbacks without causing re-renders
  const dataRef = useRef({ userId, name, selectedMoods, preferenceNote });
  useEffect(() => {
    dataRef.current = { userId, name, selectedMoods, preferenceNote };
  }, [userId, name, selectedMoods, preferenceNote]);

  // Subscribe to Firebase session changes
  useEffect(() => {
    if (!sessionCode) return;

    const unsubscribe = subscribeToSession(sessionCode, (session) => {
      setFirebaseSession(session);
    });

    return () => unsubscribe();
  }, [sessionCode]);

  // Generate session code and create Firebase session
  const handleNameSubmit = async () => {
    if (!name.trim()) return;

    // Generate a consistent participant ID for this session
    // Use existing user.id if available, otherwise use name as ID
    const newParticipantId = user?.id || name;
    setParticipantId(newParticipantId);

    // Set user if not already set
    if (!user || user.name !== name) {
      setUser(name);
    }

    // Generate code
    const code = generateSessionCode();
    setSessionCode(code);

    // Create session in Firebase immediately (without movies)
    try {
      await createWaitingSession(code, newParticipantId, name);
      setStep('code');
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Failed to create session. Please try again.');
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my CineMatch session!',
          text: `Join my movie night! Use code: ${formatSessionCode(sessionCode)}`,
          url: `${window.location.origin}/session/join?code=${sessionCode}`,
        });
      } catch (err) {
        handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  };

  // Convert API recommendation to Movie format
  const convertToMovie = (rec: MovieRecommendation, index: number, moods: MoodTag[]): Movie => ({
    id: rec.id || index + 1000,
    tmdbId: rec.id || index + 1000,
    title: rec.title,
    year: rec.release_year ? parseInt(rec.release_year) : 2024,
    genres: rec.genres || [],
    overview: rec.overview || rec.why,
    posterPath: rec.poster_url || '',
    voteAverage: rec.vote_average || 0,
    runtime: 120,
    moodTags: moods,
    emotionalProfile: { tension: 0.5, humor: 0.5, romance: 0.5, action: 0.5, thoughtfulness: 0.5 },
    goodFor: rec.why,
    trailerKey: rec.trailer_key || undefined,
  });

  // Mark self as ready and go to waiting room
  const handleSetReady = async () => {
    if (selectedMoods.length === 0) return;

    try {
      await updateParticipantPreferences(
        sessionCode,
        userId,
        selectedMoods,
        preferenceNote || '',
        true // ready = true
      );
      setStep('waiting');
    } catch (err) {
      console.error('Failed to update preferences:', err);
      setError('Failed to save preferences. Please try again.');
    }
  };

  // Called when all participants are ready
  const handleAllReady = useCallback(async () => {
    if (!firebaseSession || isLoadingAI) return;

    setIsLoadingAI(true);
    setError(null);

    try {
      // Get current values from ref
      const { userId: currentUserId, name: currentName, selectedMoods: currentMoods, preferenceNote: currentNote } = dataRef.current;

      // Get all participants' preferences
      const participants = getAllParticipantsPreferences(firebaseSession);

      // Call AI API for recommendations
      const response = await getRecommendations(participants, 10);

      // Convert recommendations to Movie format
      const movies = response.recommendations.map((rec, index) => convertToMovie(rec, index, currentMoods));

      // Store AI movies locally
      setAiMovies(movies);

      // Update Firebase session with movies
      const movieIds = movies.map(m => m.id);
      await updateSessionWithMovies(sessionCode, movieIds, movies, response.model_used);

      // Also create local session for compatibility
      createSessionWithMovies(
        currentUserId,
        currentName,
        currentMoods,
        'ASYNC',
        movieIds,
        response.model_used,
        currentNote || undefined,
        sessionCode
      );

      // Clear chat messages
      clearChatMessages();

      // Navigate to the session
      router.push(`/session/${sessionCode}`);
    } catch (err) {
      console.error('API Error:', err);
      setError('Could not connect to AI. Make sure the Python server is running.');
      setIsLoadingAI(false);
    }
  }, [firebaseSession, isLoadingAI, sessionCode, setAiMovies, createSessionWithMovies, clearChatMessages, router]);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Back button */}
        <button
          onClick={() => {
            if (step === 'name') {
              router.push('/');
            } else if (step === 'code') {
              setStep('name');
            } else if (step === 'mood') {
              setStep('code');
            } else if (step === 'waiting') {
              setStep('mood');
            }
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Step 1: Name */}
        {step === 'name' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold text-white mb-2">
              Create a Group
            </h1>
            <p className="text-gray-400 mb-8">
              Start by entering your name
            </p>

            <Input
              label="Your Name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              className="w-full mt-6"
              onClick={handleNameSubmit}
              disabled={!name.trim()}
            >
              Get Session Code
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Show Code & Share */}
        {step === 'code' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold text-white mb-2">
              Your Session Code
            </h1>
            <p className="text-gray-400 mb-6">
              Share this code with your friends so they can join
            </p>

            {/* Session Code Card */}
            <Card variant="glass" padding="lg" className="mb-6">
              <div className="flex items-center justify-center gap-4">
                <span className="text-4xl font-mono font-bold text-white tracking-wider">
                  {formatSessionCode(sessionCode)}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-sm text-green-400 text-center mt-2">Copied!</p>
              )}
            </Card>

            {/* Participants joined */}
            {firebaseSession && Object.keys(firebaseSession.participants || {}).length > 1 && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                {Object.keys(firebaseSession.participants).length} participants joined!
              </div>
            )}

            {/* Share Button */}
            <Button
              variant="secondary"
              className="w-full mb-6"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share with Friends
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">then</span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => setStep('mood')}
            >
              Set Your Preferences
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <p className="text-gray-500 text-sm text-center mt-4">
              Friends can join while you set up
            </p>
          </motion.div>
        )}

        {/* Step 3: Mood Selection with Chat */}
        {step === 'mood' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Persistent code display */}
            <div className="flex items-center justify-between mb-6 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Session:</span>
                <span className="font-mono font-medium text-white">
                  {formatSessionCode(sessionCode)}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>

            <PreferenceChat
              participantId={userId}
              participantName={name}
              messages={chatMessages}
              onAddMessage={addChatMessage}
              selectedMoods={selectedMoods}
              onMoodsChange={setSelectedMoods}
              maxMoodSelections={3}
              showMockParticipants={false}
            />

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              className="w-full mt-6"
              onClick={handleSetReady}
              disabled={selectedMoods.length === 0}
            >
              I'm Ready
              <Check className="w-4 h-4 ml-2" />
            </Button>

            <p className="text-gray-500 text-sm text-center mt-3">
              Wait for others to select their preferences
            </p>
          </motion.div>
        )}

        {/* Step 4: Waiting Room */}
        {step === 'waiting' && firebaseSession && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-2xl font-bold text-white mb-6">
              Waiting for Everyone
            </h1>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <WaitingRoom
              session={firebaseSession}
              currentUserId={userId}
              onAllReady={handleAllReady}
              isLoading={isLoadingAI}
            />
          </motion.div>
        )}

        {/* Loading Step (fallback) */}
        {step === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              AI is thinking...
            </h2>
            <p className="text-gray-400">
              Finding perfect movies for your group
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
