'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Session,
  Participant,
  SwipeAction,
  SwipeMode,
  MoodTag,
  Match,
  Movie,
  PreferenceChatMessage,
} from '@/lib/types';
import { generateSessionCode, getMatchPercentage } from '@/lib/utils';
import { generateMovieStack, detectConflicts } from '@/data/mockAI';
import { nanoid } from 'nanoid';

interface SessionState {
  currentSession: Session | null;
  swipeHistory: { movieId: number; action: SwipeAction }[];
  chatMessages: PreferenceChatMessage[];

  // Actions
  createSession: (
    userId: string,
    userName: string,
    moods: MoodTag[],
    swipeMode: SwipeMode,
    preferenceNote?: string,
    existingCode?: string
  ) => Session;
  createSessionWithMovies: (
    userId: string,
    userName: string,
    moods: MoodTag[],
    swipeMode: SwipeMode,
    movieIds: number[],
    modelUsed?: string,
    preferenceNote?: string,
    existingCode?: string
  ) => Session;
  joinSession: (
    code: string,
    userId: string,
    userName: string,
    moods: MoodTag[],
    preferenceNote?: string
  ) => boolean;
  leaveSession: () => void;
  startSession: () => void;

  // Swipe actions
  recordSwipe: (movieId: number, action: SwipeAction) => void;
  undoSwipe: () => void;

  // Match detection
  checkForNewMatches: () => Match | null;
  getMatches: () => Match[];

  // Chat messages
  addChatMessage: (message: PreferenceChatMessage) => void;
  getChatMessages: () => PreferenceChatMessage[];
  clearChatMessages: () => void;

  // Utilities
  getCurrentMovie: () => Movie | null;
  getParticipantProgress: () => { name: string; progress: number }[];
  setMovieStack: (movieIds: number[]) => void;
}

// Mock session storage (in a real app, this would be a backend)
const mockSessions = new Map<string, Session>();

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      swipeHistory: [],
      chatMessages: [],

      createSession: (userId, userName, moods, swipeMode, preferenceNote, existingCode) => {
        const code = existingCode || generateSessionCode();
        const { movies } = generateMovieStack(
          [{ name: userName, moods, preferenceNote }],
          [],
          20
        );

        const session: Session = {
          id: nanoid(),
          code,
          creatorId: userId,
          status: 'WAITING',
          swipeMode,
          participants: [
            {
              userId,
              name: userName,
              moods,
              preferenceNote,
              joinedAt: new Date(),
              isReady: true,
              currentMovieIndex: 0,
            },
          ],
          movieStack: movies.map((m) => m.id),
          swipeData: {},
          matches: [],
          aiPreferences: {
            combinedMoods: moods,
            conflicts: [],
            explanation: preferenceNote
              ? `Session created for ${userName}. Looking for ${moods.join(', ')} vibes with preference: "${preferenceNote}"`
              : `Session created for ${userName}. Waiting for others to join...`,
          },
          createdAt: new Date(),
        };

        mockSessions.set(code, session);
        set({ currentSession: session, swipeHistory: [] });
        return session;
      },

      createSessionWithMovies: (userId, userName, moods, swipeMode, movieIds, modelUsed, preferenceNote, existingCode) => {
        const code = existingCode || generateSessionCode();

        const session: Session = {
          id: nanoid(),
          code,
          creatorId: userId,
          status: 'WAITING',
          swipeMode,
          participants: [
            {
              userId,
              name: userName,
              moods,
              preferenceNote,
              joinedAt: new Date(),
              isReady: true,
              currentMovieIndex: 0,
            },
          ],
          movieStack: movieIds,
          swipeData: {},
          matches: [],
          aiPreferences: {
            combinedMoods: moods,
            conflicts: [],
            explanation: `AI (${modelUsed || 'unknown'}) recommended ${movieIds.length} movies based on ${moods.join(', ')} mood${preferenceNote ? ` with note: "${preferenceNote}"` : ''}.`,
          },
          createdAt: new Date(),
        };

        mockSessions.set(code, session);
        set({ currentSession: session, swipeHistory: [] });
        return session;
      },

      joinSession: (code, userId, userName, moods, preferenceNote) => {
        const normalizedCode = code.replace(/[-\s]/g, '').toUpperCase();

        // Check mock storage first
        let session = mockSessions.get(normalizedCode);

        // Also check current session
        const current = get().currentSession;
        if (current && current.code === normalizedCode) {
          session = current;
        }

        if (!session) {
          return false;
        }

        // Check if user already in session
        if (session.participants.some((p) => p.userId === userId)) {
          set({ currentSession: session, swipeHistory: [] });
          return true;
        }

        // Add participant
        const newParticipant: Participant = {
          userId,
          name: userName,
          moods,
          preferenceNote,
          joinedAt: new Date(),
          isReady: true,
          currentMovieIndex: 0,
        };

        // Regenerate movie stack with combined preferences
        const allParticipants = [...session.participants, newParticipant];
        const { movies, explanation, conflicts } = generateMovieStack(
          allParticipants.map((p) => ({ name: p.name, moods: p.moods, preferenceNote: p.preferenceNote })),
          [],
          20
        );

        const updatedSession: Session = {
          ...session,
          participants: allParticipants,
          movieStack: movies.map((m) => m.id),
          aiPreferences: {
            combinedMoods: Array.from(new Set(allParticipants.flatMap((p) => p.moods))) as MoodTag[],
            conflicts,
            explanation,
          },
        };

        mockSessions.set(normalizedCode, updatedSession);
        set({ currentSession: updatedSession, swipeHistory: [] });
        return true;
      },

      leaveSession: () => {
        set({ currentSession: null, swipeHistory: [] });
      },

      startSession: () => {
        const session = get().currentSession;
        if (!session) return;

        const updatedSession: Session = {
          ...session,
          status: 'ACTIVE',
        };

        mockSessions.set(session.code, updatedSession);
        set({ currentSession: updatedSession });
      },

      recordSwipe: (movieId, action) => {
        const session = get().currentSession;
        if (!session) return;

        const userId = session.participants[0]?.userId; // Current user
        if (!userId) return;

        const updatedSwipeData = {
          ...session.swipeData,
          [movieId]: {
            ...(session.swipeData[movieId] || {}),
            [userId]: action,
          },
        };

        // Check for matches - ONLY if ALL participants have swiped
        const movieSwipes = updatedSwipeData[movieId] || {};
        const participantIds = session.participants.map(p => p.userId);

        // Count how many participants have swiped on this movie
        const swipedParticipants = participantIds.filter(pid => movieSwipes[pid] !== undefined);
        const allParticipantsSwiped = swipedParticipants.length === participantIds.length;

        let newMatches = [...session.matches];

        // Only check for match if ALL participants have swiped on this movie
        if (allParticipantsSwiped && participantIds.length > 0) {
          const likedBy = Object.entries(movieSwipes)
            .filter(([_, a]) => a === 'LIKE' || a === 'SUPER_LIKE')
            .map(([id]) => id);

          // In async mode, match if 75%+ liked
          // In sync mode, match if 100% liked
          const threshold = session.swipeMode === 'ASYNC' ? 0.75 : 1;
          const matchPercentage = getMatchPercentage(
            likedBy,
            session.participants.length
          );

          if (
            matchPercentage >= threshold * 100 &&
            !session.matches.some((m) => m.movieId === movieId)
          ) {
            newMatches.push({
              movieId,
              matchPercentage,
              likedBy,
              matchedAt: new Date(),
            });
          }
        }

        const updatedSession: Session = {
          ...session,
          swipeData: updatedSwipeData,
          matches: newMatches,
        };

        mockSessions.set(session.code, updatedSession);
        set({
          currentSession: updatedSession,
          swipeHistory: [...get().swipeHistory, { movieId, action }],
        });
      },

      undoSwipe: () => {
        const session = get().currentSession;
        const history = get().swipeHistory;
        if (!session || history.length === 0) return;

        const lastSwipe = history[history.length - 1];
        const userId = session.participants[0]?.userId;
        if (!userId) return;

        // Remove the swipe
        const updatedSwipeData = { ...session.swipeData };
        if (updatedSwipeData[lastSwipe.movieId]) {
          delete updatedSwipeData[lastSwipe.movieId][userId];
          if (Object.keys(updatedSwipeData[lastSwipe.movieId]).length === 0) {
            delete updatedSwipeData[lastSwipe.movieId];
          }
        }

        // Remove any match that was created
        const updatedMatches = session.matches.filter(
          (m) => m.movieId !== lastSwipe.movieId
        );

        const updatedSession: Session = {
          ...session,
          swipeData: updatedSwipeData,
          matches: updatedMatches,
        };

        mockSessions.set(session.code, updatedSession);
        set({
          currentSession: updatedSession,
          swipeHistory: history.slice(0, -1),
        });
      },

      checkForNewMatches: () => {
        const session = get().currentSession;
        if (!session) return null;

        // Return the most recent match if it was just created
        if (session.matches.length > 0) {
          const latestMatch = session.matches[session.matches.length - 1];
          const timeSinceMatch =
            Date.now() - new Date(latestMatch.matchedAt).getTime();
          if (timeSinceMatch < 1000) {
            return latestMatch;
          }
        }

        return null;
      },

      getMatches: () => {
        const session = get().currentSession;
        return session?.matches || [];
      },

      getCurrentMovie: () => {
        // This would return the current movie based on session state
        return null;
      },

      getParticipantProgress: () => {
        const session = get().currentSession;
        if (!session) return [];

        return session.participants.map((p) => {
          const swipedCount = Object.keys(session.swipeData).filter(
            (movieId) => session.swipeData[parseInt(movieId)]?.[p.userId]
          ).length;
          return {
            name: p.name,
            progress: (swipedCount / session.movieStack.length) * 100,
          };
        });
      },

      addChatMessage: (message) => {
        const messages = get().chatMessages;
        // Replace existing mood message from same user, or add new
        const existingMoodIndex = messages.findIndex(
          (m) => m.participantId === message.participantId && m.type === 'moods'
        );

        if (message.type === 'moods' && existingMoodIndex !== -1) {
          // Update existing mood message
          const updatedMessages = [...messages];
          updatedMessages[existingMoodIndex] = message;
          set({ chatMessages: updatedMessages });
        } else {
          // Add new message
          set({ chatMessages: [...messages, message] });
        }
      },

      getChatMessages: () => {
        return get().chatMessages;
      },

      clearChatMessages: () => {
        set({ chatMessages: [] });
      },

      setMovieStack: (movieIds) => {
        const session = get().currentSession;
        if (!session) return;

        // Reset swipe data for new movie stack
        set({
          currentSession: {
            ...session,
            movieStack: movieIds,
            swipeData: {}, // Clear swipes for new movies
          },
          swipeHistory: [],
        });
      },
    }),
    {
      name: 'cinematch-session',
      partialize: (state) => ({
        currentSession: state.currentSession,
        swipeHistory: state.swipeHistory,
        chatMessages: state.chatMessages,
      }),
    }
  )
);
