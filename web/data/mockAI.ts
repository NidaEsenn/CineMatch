import { MoodTag, PreferenceConflict, AIRecommendation, Movie } from '@/lib/types';
import { mockMovies, getMoviesByMoods } from './mockMovies';
import { shuffleArray } from '@/lib/utils';

// Simulated AI preference parsing
export function parsePreferences(moods: MoodTag[]): {
  primaryMood: MoodTag;
  intensity: 'low' | 'medium' | 'high';
  suggestions: string[];
} {
  const intensityMap: Record<MoodTag, 'low' | 'medium' | 'high'> = {
    'relaxed': 'low',
    'cozy': 'low',
    'funny': 'low',
    'nostalgic': 'medium',
    'romantic': 'medium',
    'uplifting': 'medium',
    'adventurous': 'medium',
    'emotional': 'medium',
    'thrilling': 'high',
    'intense': 'high',
    'dark': 'high',
    'mind-bending': 'high',
  };

  const primaryMood = moods[0] || 'relaxed';
  const intensity = intensityMap[primaryMood];

  const suggestionMap: Record<MoodTag, string[]> = {
    'relaxed': ['Light comedies', 'Feel-good dramas', 'Animated films'],
    'intense': ['Thrillers', 'Action movies', 'Crime dramas'],
    'funny': ['Comedies', 'Animated comedies', 'Romantic comedies'],
    'romantic': ['Romance films', 'Romantic dramas', 'Love stories'],
    'mind-bending': ['Sci-fi thrillers', 'Psychological dramas', 'Mystery films'],
    'dark': ['Crime dramas', 'Horror', 'Noir films'],
    'uplifting': ['Feel-good movies', 'Sports dramas', 'Inspiring stories'],
    'nostalgic': ['Classic films', '80s/90s movies', 'Childhood favorites'],
    'adventurous': ['Epic adventures', 'Fantasy films', 'Action-adventure'],
    'emotional': ['Dramas', 'Tearjerkers', 'Character studies'],
    'cozy': ['Animated films', 'Family movies', 'Comfort watches'],
    'thrilling': ['Suspense', 'Action thrillers', 'Mystery'],
  };

  return {
    primaryMood,
    intensity,
    suggestions: suggestionMap[primaryMood] || [],
  };
}

// Detect conflicts between group preferences
export function detectConflicts(
  participants: { name: string; moods: MoodTag[] }[]
): PreferenceConflict[] {
  const conflicts: PreferenceConflict[] = [];

  // Check for mood conflicts
  const moodsByUser = new Map<string, Set<MoodTag>>();
  participants.forEach(p => {
    moodsByUser.set(p.name, new Set(p.moods));
  });

  // Conflict pairs
  const conflictingMoods: [MoodTag, MoodTag][] = [
    ['funny', 'dark'],
    ['relaxed', 'intense'],
    ['cozy', 'thrilling'],
    ['uplifting', 'dark'],
    ['romantic', 'intense'],
  ];

  conflictingMoods.forEach(([mood1, mood2]) => {
    const users1 = participants.filter(p => p.moods.includes(mood1)).map(p => p.name);
    const users2 = participants.filter(p => p.moods.includes(mood2)).map(p => p.name);

    if (users1.length > 0 && users2.length > 0 &&
        !users1.some(u => users2.includes(u))) {
      conflicts.push({
        type: 'mood',
        users: [...users1, ...users2],
        description: `${users1.join(', ')} want${users1.length === 1 ? 's' : ''} ${mood1}, but ${users2.join(', ')} want${users2.length === 1 ? 's' : ''} ${mood2}`,
        resolution: `We'll find movies that blend ${mood1} and ${mood2} elements, or alternate between styles`,
      });
    }
  });

  return conflicts;
}

// Generate AI explanation for why a movie was recommended
export function generateMovieExplanation(
  movie: Movie,
  participants: { name: string; moods: MoodTag[] }[]
): string {
  const allMoods = Array.from(new Set(participants.flatMap(p => p.moods)));
  const matchingMoods = movie.moodTags.filter(mood => allMoods.includes(mood));

  if (matchingMoods.length === 0) {
    return `A highly-rated ${movie.genres[0]} that often appeals to diverse groups.`;
  }

  const moodDescriptions: Record<MoodTag, string> = {
    'relaxed': 'laid-back vibes',
    'intense': 'edge-of-your-seat intensity',
    'funny': 'great laughs',
    'romantic': 'heartwarming romance',
    'mind-bending': 'thought-provoking twists',
    'dark': 'atmospheric depth',
    'uplifting': 'inspiring moments',
    'nostalgic': 'classic feel',
    'adventurous': 'epic adventure',
    'emotional': 'powerful emotions',
    'cozy': 'comfort movie vibes',
    'thrilling': 'suspenseful excitement',
  };

  const descriptions = matchingMoods.map(m => moodDescriptions[m]).slice(0, 2);

  if (participants.length === 1) {
    return `Matches your ${matchingMoods[0]} mood with ${descriptions[0]}.`;
  }

  // Find who wanted what
  const whoWanted = matchingMoods.map(mood => {
    const users = participants.filter(p => p.moods.includes(mood)).map(p => p.name);
    return { mood, users };
  });

  if (whoWanted.length === 1) {
    return `Perfect for the group's shared love of ${descriptions[0]}.`;
  }

  return `Combines ${descriptions.join(' and ')} - something for everyone!`;
}

// Generate movie stack based on group preferences
export function generateMovieStack(
  participants: { name: string; moods: MoodTag[]; preferenceNote?: string }[],
  watchedMovieIds: number[] = [],
  count: number = 15
): { movies: Movie[]; explanation: string; conflicts: PreferenceConflict[] } {
  const allMoods = Array.from(new Set(participants.flatMap(p => p.moods))) as MoodTag[];
  const conflicts = detectConflicts(participants);

  // Get movies matching any mood
  let matchingMovies = getMoviesByMoods(allMoods);

  // Filter out watched movies
  matchingMovies = matchingMovies.filter(m => !watchedMovieIds.includes(m.id));

  // Shuffle for variety
  matchingMovies = shuffleArray(matchingMovies);

  // Take top N
  const selectedMovies = matchingMovies.slice(0, count);

  // Generate explanation
  let explanation = '';
  if (participants.length === 1) {
    explanation = `Based on your ${allMoods.slice(0, 2).join(' and ')} mood, here are ${selectedMovies.length} movies you might love tonight.`;
  } else {
    const names = participants.map(p => p.name);
    if (conflicts.length > 0) {
      explanation = `Finding common ground between ${names.join(' and ')}... These ${selectedMovies.length} movies balance everyone's preferences.`;
    } else {
      explanation = `Great news! ${names.join(' and ')} have similar taste. Here are ${selectedMovies.length} movies you'll all enjoy.`;
    }
  }

  return {
    movies: selectedMovies,
    explanation,
    conflicts,
  };
}

// Generate match celebration message
export function generateMatchMessage(
  movie: Movie,
  participants: { name: string }[]
): string {
  const messages = [
    `It's a match! Everyone wants to watch ${movie.title}!`,
    `${movie.title} is the winner! Great choice, everyone!`,
    `You all agreed on ${movie.title}! Movie night is set!`,
    `Perfect match! ${movie.title} it is!`,
    `The group has spoken: ${movie.title}!`,
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

// AI recommendations with confidence scores
export function generateRecommendations(
  participants: { name: string; moods: MoodTag[] }[],
  currentMovieId: number
): AIRecommendation[] {
  const movie = mockMovies.find(m => m.id === currentMovieId);
  if (!movie) return [];

  const allMoods = Array.from(new Set(participants.flatMap(p => p.moods))) as MoodTag[];
  const matchingMoods = movie.moodTags.filter(mood => allMoods.includes(mood));

  const confidence = Math.min(0.95, 0.5 + matchingMoods.length * 0.15);

  const matchReasons: string[] = [];

  if (matchingMoods.length > 0) {
    matchReasons.push(`Matches ${matchingMoods.length} of your selected moods`);
  }

  if (movie.voteAverage >= 8.0) {
    matchReasons.push('Highly rated by audiences');
  }

  if (movie.genres.includes('Comedy') && allMoods.includes('funny')) {
    matchReasons.push('Great for laughs');
  }

  if (movie.runtime <= 120) {
    matchReasons.push('Good length for group viewing');
  }

  return [{
    movieId: currentMovieId,
    explanation: generateMovieExplanation(movie, participants),
    matchReasons,
    confidence,
  }];
}
