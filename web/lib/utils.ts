import { customAlphabet } from 'nanoid';

// Generate 8-character session codes (uppercase letters + numbers, no confusing chars)
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

export function generateSessionCode(): string {
  return generateCode();
}

export function formatSessionCode(code: string): string {
  // Format as XXXX-XXXX for readability
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function parseSessionCode(input: string): string {
  // Remove dashes and spaces, uppercase
  return input.replace(/[-\s]/g, '').toUpperCase();
}

export function getTMDBImageUrl(path: string, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string {
  if (!path) return '/placeholder-movie.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getMatchPercentage(likedBy: string[], totalParticipants: number): number {
  return Math.round((likedBy.length / totalParticipants) * 100);
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getMoodEmoji(mood: string): string {
  const emojiMap: Record<string, string> = {
    'relaxed': '😌',
    'intense': '🔥',
    'funny': '😂',
    'romantic': '💕',
    'mind-bending': '🤯',
    'dark': '🌑',
    'uplifting': '✨',
    'nostalgic': '📼',
    'adventurous': '🗺️',
    'emotional': '😢',
    'cozy': '🛋️',
    'thrilling': '😱',
  };
  return emojiMap[mood] || '🎬';
}

export function getMoodColor(mood: string): string {
  const colorMap: Record<string, string> = {
    'relaxed': 'bg-blue-500',
    'intense': 'bg-red-500',
    'funny': 'bg-yellow-500',
    'romantic': 'bg-pink-500',
    'mind-bending': 'bg-purple-500',
    'dark': 'bg-gray-700',
    'uplifting': 'bg-amber-400',
    'nostalgic': 'bg-orange-400',
    'adventurous': 'bg-green-500',
    'emotional': 'bg-indigo-500',
    'cozy': 'bg-amber-600',
    'thrilling': 'bg-rose-600',
  };
  return colorMap[mood] || 'bg-gray-500';
}

export function getGenreColor(genre: string): string {
  const colorMap: Record<string, string> = {
    'Action': 'bg-red-600',
    'Adventure': 'bg-green-600',
    'Animation': 'bg-blue-500',
    'Comedy': 'bg-yellow-500',
    'Crime': 'bg-gray-700',
    'Documentary': 'bg-teal-600',
    'Drama': 'bg-purple-600',
    'Family': 'bg-pink-400',
    'Fantasy': 'bg-violet-500',
    'History': 'bg-amber-700',
    'Horror': 'bg-gray-900',
    'Music': 'bg-fuchsia-500',
    'Mystery': 'bg-indigo-700',
    'Romance': 'bg-rose-500',
    'Science Fiction': 'bg-cyan-600',
    'Thriller': 'bg-orange-600',
    'War': 'bg-stone-600',
    'Western': 'bg-amber-800',
  };
  return colorMap[genre] || 'bg-gray-500';
}

// Parse Netflix viewing history CSV
export function parseNetflixCSV(csvContent: string): { title: string; date: Date }[] {
  const lines = csvContent.split('\n');
  const results: { title: string; date: Date }[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Netflix format: "Title","Date"
    const match = line.match(/"([^"]+)","([^"]+)"/);
    if (match) {
      results.push({
        title: match[1],
        date: new Date(match[2]),
      });
    }
  }

  return results;
}

// Local storage helpers
export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultValue;
      }
    }
  }
  return defaultValue;
}

export function removeFromStorage(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
}
