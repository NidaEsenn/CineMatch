// web/lib/api.ts
// API service for communicating with Python Model Gateway

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Participant {
  name: string;
  moods: string[];
  note?: string | null;
}

export interface MovieRecommendation {
  id: number;
  title: string;
  why: string;
  poster_url?: string | null;
  overview?: string | null;
  vote_average?: number | null;
  release_year?: string | null;
  genres: string[];
  trailer_key?: string | null;  // YouTube video ID
}

export interface FairnessStats {
  overall_fairness: number;
  user_satisfaction: Record<string, number>;
  least_satisfied?: string | null;
  most_satisfied?: string | null;
}

export interface RecommendResponse {
  recommendations: MovieRecommendation[];
  model_used: string;
  response_time_ms: number;
  cost_usd: number;
  fairness_applied: boolean;
  fairness_stats?: FairnessStats | null;
  feedback_applied: boolean;
  round: number;
  seen_count: number;
}

export interface SwipeResponse {
  recorded: boolean;
  total_swipes: number;
  feedback_ready: boolean;
}

export interface SessionStats {
  session_id: string;
  stats: Record<string, { total: number; likes: number; dislikes: number; skips: number }>;
  seen_films: number[];
}

/**
 * Get movie recommendations from the AI gateway.
 *
 * @param participants - List of participants with their mood preferences
 * @param numRecommendations - Number of movies to recommend
 * @param sessionId - Optional session ID for feedback-aware recommendations
 * @param round - Which round (1 = first, 2+ = after "10 More Movies")
 */
export async function getRecommendations(
  participants: Participant[],
  numRecommendations: number = 5,
  sessionId?: string,
  round: number = 1
): Promise<RecommendResponse> {
  const response = await fetch(`${API_BASE_URL}/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      participants,
      num_recommendations: numRecommendations,
      session_id: sessionId,
      round,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Record a swipe action to the backend for feedback learning.
 */
export async function recordSwipeToBackend(
  sessionId: string,
  userName: string,
  movieId: number,
  action: 'like' | 'dislike' | 'skip'
): Promise<SwipeResponse> {
  const response = await fetch(`${API_BASE_URL}/swipe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      user_name: userName,
      movie_id: movieId,
      action,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get session statistics (swipe counts per user, seen films).
 */
export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/stats`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Clear session data (swipes, seen films).
 */
export async function clearSession(sessionId: string): Promise<{ cleared: boolean }> {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Match Types
export interface MovieMatch {
  movie_id: number;
  title?: string;
  poster_url?: string;
  overview?: string;
  vote_average?: number;
  genres?: string[];
  trailer_key?: string;
  votes: Record<string, string>;  // {user_name: action}
  match_percentage: number;
  liked_count?: number;
  total_voters?: number;
}

export interface MatchesResponse {
  session_id: string;
  user_count: number;
  matches: {
    perfect: MovieMatch[];
    majority: MovieMatch[];
  };
  no_match_count: number;
}

/**
 * Get calculated matches for a session from the backend.
 * Uses stored swipe data to determine group matches.
 */
export async function getMatches(sessionId: string): Promise<MatchesResponse> {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/matches`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
