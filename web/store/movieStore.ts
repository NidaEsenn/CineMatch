'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Movie } from '@/lib/types';
import { mockMovies, getMovieById } from '@/data/mockMovies';

interface MovieState {
  movies: Movie[];
  aiMovies: Movie[];  // Movies from AI recommendations
  isLoading: boolean;

  // Actions
  getMovieById: (id: number) => Movie | undefined;
  getMoviesByIds: (ids: number[]) => Movie[];
  searchMovies: (query: string) => Movie[];
  setAiMovies: (movies: Movie[]) => void;
  getAiMovies: () => Movie[];
}

export const useMovieStore = create<MovieState>()(
  persist(
    (set, get) => ({
  movies: mockMovies,
  aiMovies: [],
  isLoading: false,

  getMovieById: (id: number) => {
    // Check AI movies first, then fallback to mock movies
    const aiMovie = get().aiMovies.find((m) => m.id === id);
    if (aiMovie) return aiMovie;
    return get().movies.find((m) => m.id === id);
  },

  getMoviesByIds: (ids: number[]) => {
    const movies = get().movies;
    const aiMovies = get().aiMovies;
    return ids.map((id) => {
      // Check AI movies first
      const aiMovie = aiMovies.find((m) => m.id === id);
      if (aiMovie) return aiMovie;
      return movies.find((m) => m.id === id);
    }).filter(Boolean) as Movie[];
  },

  searchMovies: (query: string) => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];

    return get().movies.filter(
      (m) =>
        m.title.toLowerCase().includes(normalizedQuery) ||
        m.genres.some((g) => g.toLowerCase().includes(normalizedQuery)) ||
        m.moodTags.some((t) => t.toLowerCase().includes(normalizedQuery))
    );
  },

  setAiMovies: (movies: Movie[]) => {
    set({ aiMovies: movies });
  },

  getAiMovies: () => {
    return get().aiMovies;
  },
}),
    {
      name: 'cinematch-movies',
      partialize: (state) => ({ aiMovies: state.aiMovies }),
    }
  )
);
