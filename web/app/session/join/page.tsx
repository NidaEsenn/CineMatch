'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, AlertCircle, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PreferenceChat from '@/components/ai/PreferenceChat';
import WaitingRoom from '@/components/session/WaitingRoom';
import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { useMovieStore } from '@/store/movieStore';
import { MoodTag, Movie } from '@/lib/types';
import { parseSessionCode } from '@/lib/utils';
import {
  joinFirebaseSession,
  sessionExists,
  subscribeToSession,
  updateParticipantPreferences,
  FirebaseSession,
} from '@/lib/firebase';

type Step = 'code' | 'name' | 'mood' | 'waiting';

export default function JoinSessionPage() {
  const router = useRouter();
  const { joinSession, createSessionWithMovies, chatMessages, addChatMessage, clearChatMessages } = useSessionStore();
  const { user, setUser } = useUserStore();
  const { setAiMovies } = useMovieStore();

  const [step, setStep] = useState<Step>('code');
  const [sessionCode, setSessionCode] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [selectedMoods, setSelectedMoods] = useState<MoodTag[]>([]);
  const [error, setError] = useState('');
  const [firebaseSession, setFirebaseSession] = useState<FirebaseSession | null>(null);
  // Store the participant ID used when joining - this ensures consistency
  const [participantId, setParticipantId] = useState<string | null>(null);

  // Use the stored participantId, or fall back to user.id or name
  const userId = participantId || user?.id || name;

  // Extract preference note from chat messages
  const preferenceNote = chatMessages
    .filter((m) => m.participantId === userId && (m.type === 'text' || m.type === 'voice'))
    .map((m) => m.text)
    .filter(Boolean)
    .join('. ');

  // Use refs to access current values in the subscription callback without causing re-subscription
  const dataRef = useRef({ userId, name, selectedMoods, preferenceNote });
  useEffect(() => {
    dataRef.current = { userId, name, selectedMoods, preferenceNote };
  }, [userId, name, selectedMoods, preferenceNote]);

  // Subscribe to Firebase session changes - only re-subscribe when sessionCode changes
  useEffect(() => {
    const normalizedCode = parseSessionCode(sessionCode);
    if (!normalizedCode || normalizedCode.length !== 8) return;

    const unsubscribe = subscribeToSession(normalizedCode, (session) => {
      setFirebaseSession(session);

      // If session has movies and status is active, redirect to swipe
      if (session && session.status === 'active' && session.movieIds && session.movieIds.length > 0) {
        // Convert Firebase movies to local Movie format and store them
        if (session.movies) {
          const { userId: currentUserId, name: currentName, selectedMoods: currentMoods, preferenceNote: currentNote } = dataRef.current;

          // Use movieIds array to preserve order (same as host)
          const movies: Movie[] = session.movieIds
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
              moodTags: currentMoods,
              emotionalProfile: { tension: 0.5, humor: 0.5, romance: 0.5, action: 0.5, thoughtfulness: 0.5 },
              goodFor: m.why,
              trailerKey: m.trailerKey || undefined,
            }));
          setAiMovies(movies);

          // Create local session with movies for the joiner
          const movieIds = movies.map(m => m.id);
          createSessionWithMovies(
            currentUserId,
            currentName,
            currentMoods,
            'ASYNC',
            movieIds,
            session.modelUsed || 'groq',
            currentNote || undefined,
            normalizedCode
          );

          // Clear chat messages after joining
          clearChatMessages();

          // Navigate to swipe
          router.push(`/session/${normalizedCode}`);
        }
      }
    });

    return () => unsubscribe();
  }, [sessionCode, setAiMovies, joinSession, clearChatMessages, router]);

  const handleCodeSubmit = async () => {
    const normalizedCode = parseSessionCode(sessionCode);
    if (normalizedCode.length !== 8) {
      setError('Please enter a valid 8-character code');
      return;
    }

    // Check if session exists in Firebase
    const exists = await sessionExists(normalizedCode);
    if (!exists) {
      setError('Session not found. Please check the code and try again.');
      return;
    }

    setError('');
    setStep('name');
  };

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

    const normalizedCode = parseSessionCode(sessionCode);

    try {
      // Join session in Firebase (without moods yet)
      await joinFirebaseSession(
        normalizedCode,
        newParticipantId,  // Use the captured ID, not user?.id which may change
        name,
        [], // empty moods for now
        undefined
      );

      setStep('mood');
    } catch (err) {
      console.error('Failed to join session:', err);
      setError('Failed to join session. Please try again.');
    }
  };

  const handleSetReady = async () => {
    if (selectedMoods.length === 0) return;

    const normalizedCode = parseSessionCode(sessionCode);

    try {
      await updateParticipantPreferences(
        normalizedCode,
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

  // For join page, onAllReady doesn't need to do anything - host will trigger AI
  // We just wait for session.status to become 'active'
  const handleAllReady = () => {
    // Do nothing - host will trigger AI call
    // We're already subscribed to session changes and will redirect when movies are loaded
  };

  // Format code as user types (XXXX-XXXX)
  const handleCodeChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length <= 8) {
      if (cleaned.length > 4) {
        setSessionCode(`${cleaned.slice(0, 4)}-${cleaned.slice(4)}`);
      } else {
        setSessionCode(cleaned);
      }
    }
    setError('');
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Back button */}
        <button
          onClick={() => {
            if (step === 'code') {
              router.push('/');
            } else if (step === 'name') {
              setStep('code');
            } else if (step === 'mood') {
              setStep('name');
            } else if (step === 'waiting') {
              setStep('mood');
            }
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Step 1: Enter Code */}
        {step === 'code' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold text-white mb-2">
              Join a Session
            </h1>
            <p className="text-gray-400 mb-8">
              Enter the session code shared with you
            </p>

            <Input
              label="Session Code"
              placeholder="XXXX-XXXX"
              value={sessionCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="text-center text-2xl font-mono tracking-wider"
              maxLength={9}
              autoFocus
              error={error}
            />

            {error && (
              <div className="flex items-center gap-2 text-red-400 mt-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Button
              className="w-full mt-6"
              onClick={handleCodeSubmit}
              disabled={sessionCode.replace(/-/g, '').length !== 8}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Enter Name */}
        {step === 'name' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold text-white mb-2">
              What&apos;s Your Name?
            </h1>
            <p className="text-gray-400 mb-8">
              Let others know who you are
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
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 3: Mood Selection with Chat */}
        {step === 'mood' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
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
              isLoading={false}
            />

            <p className="text-gray-500 text-sm text-center mt-4">
              Host will start when everyone is ready...
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
