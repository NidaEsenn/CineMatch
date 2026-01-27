// Movie types
export interface Movie {
  id: number;
  tmdbId: number;
  title: string;
  year: number;
  genres: string[];
  overview: string;
  posterPath: string;
  backdropPath?: string;
  voteAverage: number;
  runtime: number;
  moodTags: MoodTag[];
  emotionalProfile: EmotionalProfile;
  goodFor: string;
  notGoodFor?: string;
  trailerKey?: string; // YouTube video ID for trailer
}

export type MoodTag =
  | 'relaxed'
  | 'intense'
  | 'funny'
  | 'romantic'
  | 'mind-bending'
  | 'dark'
  | 'uplifting'
  | 'nostalgic'
  | 'adventurous'
  | 'emotional'
  | 'cozy'
  | 'thrilling';

export interface EmotionalProfile {
  tension: number;      // 0-1
  humor: number;        // 0-1
  romance: number;      // 0-1
  action: number;       // 0-1
  thoughtfulness: number; // 0-1
}

// User types
export interface User {
  id: string;
  name: string;
  avatar?: string;
  watchHistory: WatchHistoryEntry[];
  createdAt: Date;
}

export interface WatchHistoryEntry {
  movieId: number;
  watchedAt: Date;
  source: 'netflix' | 'prime' | 'disney' | 'letterboxd' | 'manual';
  rating?: number;
}

// Session types
export type SwipeMode = 'ASYNC' | 'SYNC';
export type SessionStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED';

export interface Session {
  id: string;
  code: string;
  creatorId: string;
  status: SessionStatus;
  swipeMode: SwipeMode;
  participants: Participant[];
  movieStack: number[];
  swipeData: SwipeData;
  matches: Match[];
  aiPreferences: AIPreferences;
  createdAt: Date;
}

export interface Participant {
  userId: string;
  name: string;
  moods: MoodTag[];
  preferenceNote?: string; // Optional text note for additional preferences
  joinedAt: Date;
  isReady: boolean;
  currentMovieIndex: number;
}

export interface SwipeData {
  [movieId: number]: {
    [userId: string]: SwipeAction;
  };
}

export type SwipeAction = 'LIKE' | 'PASS' | 'SUPER_LIKE';

export interface Match {
  movieId: number;
  matchPercentage: number;
  likedBy: string[];
  matchedAt: Date;
  isWatched?: boolean;
  watchedBy?: string[];
}

// AI types
export interface AIPreferences {
  combinedMoods: MoodTag[];
  conflicts: PreferenceConflict[];
  explanation: string;
}

export interface PreferenceConflict {
  type: 'mood' | 'genre' | 'intensity';
  users: string[];
  description: string;
  resolution: string;
}

export interface AIRecommendation {
  movieId: number;
  explanation: string;
  matchReasons: string[];
  confidence: number;
}

// Preference Chat types
export type InputMode = 'quick' | 'type' | 'voice';

export interface PreferenceChatMessage {
  id: string;
  participantId: string;
  participantName: string;
  type: 'moods' | 'text' | 'voice' | 'ai';
  moods?: MoodTag[];           // For mood selections
  text?: string;               // For typed/voice messages
  timestamp: Date;
}

// Component props
export interface SwipeDirection {
  direction: 'left' | 'right' | 'up';
  velocity: number;
}

// Store types
export interface SessionStore {
  currentSession: Session | null;
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;

  createSession: (name: string, moods: MoodTag[], swipeMode: SwipeMode) => Session;
  joinSession: (code: string, name: string, moods: MoodTag[]) => boolean;
  leaveSession: () => void;
  startSession: () => void;

  recordSwipe: (movieId: number, action: SwipeAction) => void;
  getMatches: () => Match[];
  checkForNewMatches: () => Match | null;
}

export interface MovieStore {
  movies: Movie[];
  currentMovieIndex: number;
  isLoading: boolean;

  getCurrentMovie: () => Movie | null;
  getNextMovie: () => void;
  getPreviousMovie: () => void;
  getMovieById: (id: number) => Movie | undefined;
  filterByMoods: (moods: MoodTag[]) => Movie[];
}

export interface UserStore {
  user: User | null;
  watchHistory: WatchHistoryEntry[];

  setUser: (name: string) => void;
  addToWatchHistory: (entry: WatchHistoryEntry) => void;
  importWatchHistory: (entries: WatchHistoryEntry[]) => void;
  clearWatchHistory: () => void;
  hasWatched: (movieId: number) => boolean;
}
