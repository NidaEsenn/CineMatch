import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, push, update, remove, Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDOgqB54JKcOR2QDgcZkCVNDIlpufz7SSg",
  authDomain: "cinematch-90c5a.firebaseapp.com",
  databaseURL: "https://cinematch-90c5a-default-rtdb.firebaseio.com",
  projectId: "cinematch-90c5a",
  storageBucket: "cinematch-90c5a.firebasestorage.app",
  messagingSenderId: "771999907550",
  appId: "1:771999907550:web:ac89881427c64d907f4c4f",
  measurementId: "G-Y4EQ1VK7R0"
};

// Initialize Firebase (avoid re-initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);

// Session types for Firebase
export interface FirebaseParticipant {
  id: string;
  name: string;
  moods: string[];
  preferenceNote?: string;
  joinedAt: number;
  swipes: Record<number, 'like' | 'dislike' | 'super_like'>;
  ready: boolean;
}

export interface FirebaseSession {
  code: string;
  hostId: string;
  createdAt: number;
  status: 'waiting' | 'active' | 'completed';
  participants: Record<string, FirebaseParticipant>;
  movieIds: number[];
  movies?: Record<number, {
    id: number;
    title: string;
    posterPath: string;
    overview: string;
    genres: string[];
    voteAverage: number;
    trailerKey?: string;
    why?: string;
  }>;
  modelUsed?: string;
}

// Create a new session
export async function createFirebaseSession(
  code: string,
  hostId: string,
  hostName: string,
  moods: string[],
  movieIds: number[],
  movies: any[],
  modelUsed?: string,
  preferenceNote?: string
): Promise<void> {
  const sessionRef = ref(database, `sessions/${code}`);

  const moviesMap: Record<number, any> = {};
  movies.forEach(m => {
    moviesMap[m.id] = {
      id: m.id,
      title: m.title,
      posterPath: m.posterPath,
      overview: m.overview,
      genres: m.genres,
      voteAverage: m.voteAverage,
      trailerKey: m.trailerKey || null,
      why: m.goodFor || null,
    };
  });

  const session: FirebaseSession = {
    code,
    hostId,
    createdAt: Date.now(),
    status: 'waiting',
    participants: {
      [hostId]: {
        id: hostId,
        name: hostName,
        moods,
        preferenceNote: preferenceNote || '',
        joinedAt: Date.now(),
        swipes: {},
        ready: false,
      }
    },
    movieIds,
    movies: moviesMap,
    modelUsed,
  };

  await set(sessionRef, session);
}

// Join an existing session
export async function joinFirebaseSession(
  code: string,
  userId: string,
  userName: string,
  moods: string[],
  preferenceNote?: string
): Promise<FirebaseSession | null> {
  const sessionRef = ref(database, `sessions/${code}`);
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) {
    return null;
  }

  const participantRef = ref(database, `sessions/${code}/participants/${userId}`);
  await set(participantRef, {
    id: userId,
    name: userName,
    moods,
    preferenceNote: preferenceNote || '',
    joinedAt: Date.now(),
    swipes: {},
    ready: false,
  });

  // Return updated session
  const updatedSnapshot = await get(sessionRef);
  return updatedSnapshot.val() as FirebaseSession;
}

// Get session by code
export async function getFirebaseSession(code: string): Promise<FirebaseSession | null> {
  const sessionRef = ref(database, `sessions/${code}`);
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val() as FirebaseSession;
}

// Subscribe to session changes (realtime)
export function subscribeToSession(
  code: string,
  callback: (session: FirebaseSession | null) => void
): () => void {
  const sessionRef = ref(database, `sessions/${code}`);

  const unsubscribe = onValue(sessionRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as FirebaseSession);
    } else {
      callback(null);
    }
  });

  return unsubscribe;
}

// Record a swipe
export async function recordSwipe(
  code: string,
  odIds: string,
  movieId: number,
  decision: 'like' | 'dislike' | 'super_like'
): Promise<void> {
  const swipeRef = ref(database, `sessions/${code}/participants/${odIds}/swipes/${movieId}`);
  await set(swipeRef, decision);
}

// Update session status
export async function updateSessionStatus(
  code: string,
  status: 'waiting' | 'active' | 'completed'
): Promise<void> {
  const statusRef = ref(database, `sessions/${code}/status`);
  await set(statusRef, status);
}

// Check if session exists
export async function sessionExists(code: string): Promise<boolean> {
  const sessionRef = ref(database, `sessions/${code}`);
  const snapshot = await get(sessionRef);
  return snapshot.exists();
}

// Create a waiting session (without movies - for the new flow)
export async function createWaitingSession(
  code: string,
  hostId: string,
  hostName: string
): Promise<void> {
  const sessionRef = ref(database, `sessions/${code}`);

  const session: FirebaseSession = {
    code,
    hostId,
    createdAt: Date.now(),
    status: 'waiting',
    participants: {
      [hostId]: {
        id: hostId,
        name: hostName,
        moods: [],
        preferenceNote: '',
        joinedAt: Date.now(),
        swipes: {},
        ready: false,
      }
    },
    movieIds: [],
  };

  await set(sessionRef, session);
}

// Update participant's moods and ready status
export async function updateParticipantPreferences(
  code: string,
  odIds: string,
  moods: string[],
  preferenceNote: string,
  ready: boolean
): Promise<void> {
  const participantRef = ref(database, `sessions/${code}/participants/${odIds}`);
  const snapshot = await get(participantRef);

  if (snapshot.exists()) {
    const current = snapshot.val();
    await set(participantRef, {
      ...current,
      moods,
      preferenceNote,
      ready,
    });
  }
}

// Mark participant as ready
export async function setParticipantReady(
  code: string,
  odIds: string,
  ready: boolean
): Promise<void> {
  const readyRef = ref(database, `sessions/${code}/participants/${odIds}/ready`);
  await set(readyRef, ready);
}

// Update session with movies (after AI call)
export async function updateSessionWithMovies(
  code: string,
  movieIds: number[],
  movies: any[],
  modelUsed: string
): Promise<void> {
  const moviesMap: Record<number, any> = {};
  movies.forEach(m => {
    moviesMap[m.id] = {
      id: m.id,
      title: m.title,
      posterPath: m.posterPath,
      overview: m.overview,
      genres: m.genres,
      voteAverage: m.voteAverage,
      trailerKey: m.trailerKey || null,
      why: m.goodFor || null,
    };
  });

  const sessionRef = ref(database, `sessions/${code}`);
  const snapshot = await get(sessionRef);

  if (snapshot.exists()) {
    const current = snapshot.val();
    await set(sessionRef, {
      ...current,
      movieIds,
      movies: moviesMap,
      modelUsed,
      status: 'active',
    });
  }
}

// Check if all participants are ready
export function areAllParticipantsReady(session: FirebaseSession): boolean {
  const participants = Object.values(session.participants || {});
  if (participants.length === 0) return false;
  return participants.every(p => p.ready);
}

// Get all participants' preferences for AI call
export function getAllParticipantsPreferences(session: FirebaseSession): Array<{
  name: string;
  moods: string[];
  note: string | null;
}> {
  return Object.values(session.participants || {}).map(p => ({
    name: p.name,
    moods: p.moods,
    note: p.preferenceNote || null,
  }));
}

export { database, ref, onValue };
