export const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export const ALL_GENRES = Object.values(GENRE_MAP);

export const MOOD_OPTIONS = [
  { id: 'relaxed', label: 'Relaxed', emoji: '😌', description: 'Easy-going, feel-good vibes' },
  { id: 'intense', label: 'Intense', emoji: '🔥', description: 'Edge-of-your-seat excitement' },
  { id: 'funny', label: 'Funny', emoji: '😂', description: 'Laughs and good times' },
  { id: 'romantic', label: 'Romantic', emoji: '💕', description: 'Love stories and chemistry' },
  { id: 'mind-bending', label: 'Mind-bending', emoji: '🤯', description: 'Twists and deep thinking' },
  { id: 'dark', label: 'Dark', emoji: '🌑', description: 'Gritty, serious themes' },
  { id: 'uplifting', label: 'Uplifting', emoji: '✨', description: 'Inspiring and heartwarming' },
  { id: 'nostalgic', label: 'Nostalgic', emoji: '📼', description: 'Classic, throwback feels' },
  { id: 'adventurous', label: 'Adventurous', emoji: '🗺️', description: 'Epic journeys and discovery' },
  { id: 'emotional', label: 'Emotional', emoji: '😢', description: 'Moving and tear-jerking' },
  { id: 'cozy', label: 'Cozy', emoji: '🛋️', description: 'Comfort food for the soul' },
  { id: 'thrilling', label: 'Thrilling', emoji: '😱', description: 'Suspense and adrenaline' },
] as const;

export type MoodId = typeof MOOD_OPTIONS[number]['id'];
