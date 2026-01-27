'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PreferenceChat from '@/components/ai/PreferenceChat';
import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { useMovieStore } from '@/store/movieStore';
import { MoodTag, Movie } from '@/lib/types';
import { getRecommendations, RecommendResponse, MovieRecommendation } from '@/lib/api';

type Step = 'name' | 'mood' | 'loading';

export default function SoloPage() {
  const router = useRouter();
  const { createSessionWithMovies, chatMessages, addChatMessage, clearChatMessages } = useSessionStore();
  const { user, setUser } = useUserStore();
  const { setAiMovies } = useMovieStore();

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(user?.name || '');
  const [selectedMoods, setSelectedMoods] = useState<MoodTag[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Extract preference note from chat messages
  const preferenceNote = chatMessages
    .filter((m) => m.participantId === (user?.id || name) && (m.type === 'text' || m.type === 'voice'))
    .map((m) => m.text)
    .filter(Boolean)
    .join('. ');

  // Convert API recommendation to Movie format
  const convertToMovie = (rec: MovieRecommendation, index: number): Movie => ({
    id: rec.id || index + 1000,  // Use API id or generate one
    tmdbId: rec.id || index + 1000,
    title: rec.title,
    year: rec.release_year ? parseInt(rec.release_year) : 2024,
    genres: rec.genres || [],
    overview: rec.overview || rec.why,
    posterPath: rec.poster_url || '',
    voteAverage: rec.vote_average || 0,
    runtime: 120,  // Default runtime
    moodTags: selectedMoods,
    emotionalProfile: { tension: 0.5, humor: 0.5, romance: 0.5, action: 0.5, thoughtfulness: 0.5 },
    goodFor: rec.why,
    trailerKey: rec.trailer_key || undefined,  // YouTube video ID for trailer
  });

  const handleGetRecommendations = async () => {
    if (!name.trim() || selectedMoods.length === 0) return;

    setStep('loading');
    setError(null);

    try {
      const response = await getRecommendations(
        [{ name, moods: selectedMoods, note: preferenceNote || null }],
        5
      );

      // Convert recommendations to Movie format
      const movies = response.recommendations.map((rec, index) => convertToMovie(rec, index));

      // Store AI movies in the movie store
      setAiMovies(movies);

      // Set user if not already set
      if (!user || user.name !== name) {
        setUser(name);
      }

      // Create session directly with AI movie IDs
      const userId = user?.id || name;
      const movieIds = movies.map(m => m.id);
      const session = createSessionWithMovies(
        userId,
        name,
        selectedMoods,
        'ASYNC',
        movieIds,
        response.model_used,
        preferenceNote || undefined
      );

      // Clear chat messages after creating session
      clearChatMessages();

      // Navigate directly to swipe
      router.push(`/session/${session.code}`);
    } catch (err) {
      console.error('API Error:', err);
      setError('Could not connect to AI. Make sure the Python server is running on localhost:8000');
      setStep('mood');
    }
  };


  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Back button */}
        <button
          onClick={() => {
            if (step === 'name') {
              router.push('/');
            } else {
              setStep('name');
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
              Solo Movie Night
            </h1>
            <p className="text-gray-400 mb-8">
              Get personalized recommendations just for you
            </p>

            <Input
              label="Your Name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <Button
              className="w-full mt-6"
              onClick={() => setStep('mood')}
              disabled={!name.trim()}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Mood Selection with Chat */}
        {step === 'mood' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <PreferenceChat
              participantId={user?.id || name}
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
              onClick={handleGetRecommendations}
              disabled={selectedMoods.length === 0}
            >
              Get AI Recommendations
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 3: Loading */}
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
              Analyzing your mood and finding perfect movies
            </p>
          </motion.div>
        )}

      </div>
    </div>
  );
}
