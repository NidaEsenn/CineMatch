'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, WatchHistoryEntry } from '@/lib/types';
import { nanoid } from 'nanoid';

interface UserState {
  user: User | null;

  // Actions
  setUser: (name: string) => void;
  clearUser: () => void;
  addToWatchHistory: (entry: Omit<WatchHistoryEntry, 'watchedAt'>) => void;
  importWatchHistory: (entries: WatchHistoryEntry[]) => void;
  clearWatchHistory: () => void;
  hasWatched: (movieId: number) => boolean;
  getWatchedMovieIds: () => number[];
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,

      setUser: (name: string) => {
        set({
          user: {
            id: nanoid(),
            name,
            watchHistory: get().user?.watchHistory || [],
            createdAt: new Date(),
          },
        });
      },

      clearUser: () => {
        set({ user: null });
      },

      addToWatchHistory: (entry) => {
        const user = get().user;
        if (!user) return;

        // Check if already in history
        if (user.watchHistory.some((e) => e.movieId === entry.movieId)) {
          return;
        }

        set({
          user: {
            ...user,
            watchHistory: [
              ...user.watchHistory,
              { ...entry, watchedAt: new Date() },
            ],
          },
        });
      },

      importWatchHistory: (entries) => {
        const user = get().user;
        if (!user) return;

        // Merge, avoiding duplicates
        const existingIds = new Set(user.watchHistory.map((e) => e.movieId));
        const newEntries = entries.filter((e) => !existingIds.has(e.movieId));

        set({
          user: {
            ...user,
            watchHistory: [...user.watchHistory, ...newEntries],
          },
        });
      },

      clearWatchHistory: () => {
        const user = get().user;
        if (!user) return;

        set({
          user: {
            ...user,
            watchHistory: [],
          },
        });
      },

      hasWatched: (movieId: number) => {
        const user = get().user;
        if (!user) return false;
        return user.watchHistory.some((e) => e.movieId === movieId);
      },

      getWatchedMovieIds: () => {
        const user = get().user;
        if (!user) return [];
        return user.watchHistory.map((e) => e.movieId);
      },
    }),
    {
      name: 'cinematch-user',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
