"""
Feedback Learner Module - Online Learning from Swipes

Kullanıcı swipe verilerini toplayarak embedding'leri
gerçek zamanlı olarak refine eder.

Formula:
refined = original + like_weight * liked_centroid - dislike_weight * disliked_centroid
refined = normalize(refined)
"""

import numpy as np
from typing import Dict, List, Optional
from datetime import datetime


class FeedbackLearner:
    """
    Swipe feedback'lerden öğrenerek kullanıcı tercihlerini refine eder.

    Öğrenme süreci:
    1. Kullanıcı swipe yapar (like/dislike/skip)
    2. 3+ swipe sonrası embedding güncellenir
    3. Liked filmlere yaklaşır, disliked filmlerden uzaklaşır
    """

    def __init__(self, embedding_engine):
        """
        Args:
            embedding_engine: EmbeddingEngine instance (model + vector store)
        """
        self.embedding_engine = embedding_engine

        # Session bazlı swipe storage
        # session_id -> {user_name -> [swipes]}
        self.session_swipes: Dict[str, Dict[str, List[Dict]]] = {}

        # Film embedding cache (ChromaDB'den çekilen)
        self._film_embedding_cache: Dict[int, np.ndarray] = {}

    def record_swipe(
        self,
        session_id: str,
        user_name: str,
        movie_id: int,
        action: str  # 'like', 'dislike', 'skip'
    ) -> Dict:
        """
        Swipe kaydı yap.

        Returns:
            {"recorded": True, "total_swipes": int}
        """
        if session_id not in self.session_swipes:
            self.session_swipes[session_id] = {}

        if user_name not in self.session_swipes[session_id]:
            self.session_swipes[session_id][user_name] = []

        # Aynı film için duplicate swipe kontrolü
        existing = [s for s in self.session_swipes[session_id][user_name]
                   if s['movie_id'] == movie_id]
        if existing:
            # Güncelle
            existing[0]['action'] = action
            existing[0]['timestamp'] = datetime.now().isoformat()
        else:
            # Yeni ekle
            self.session_swipes[session_id][user_name].append({
                'movie_id': movie_id,
                'action': action,
                'timestamp': datetime.now().isoformat()
            })

        total = len(self.session_swipes[session_id][user_name])
        return {"recorded": True, "total_swipes": total}

    def _get_film_embedding(self, movie_id: int) -> Optional[np.ndarray]:
        """
        Film embedding'ini al (cache veya ChromaDB'den).
        """
        if movie_id in self._film_embedding_cache:
            return self._film_embedding_cache[movie_id]

        # ChromaDB'den al
        try:
            result = self.embedding_engine.vector_store.collection.get(
                ids=[str(movie_id)],
                include=["embeddings"]
            )

            if result['embeddings'] and len(result['embeddings']) > 0:
                embedding = np.array(result['embeddings'][0])
                self._film_embedding_cache[movie_id] = embedding
                return embedding
        except Exception as e:
            print(f"Error getting embedding for movie {movie_id}: {e}")

        return None

    def get_refined_embedding(
        self,
        session_id: str,
        user_name: str,
        initial_embedding: np.ndarray,
        like_weight: float = 0.3,
        dislike_weight: float = 0.2,
        min_swipes: int = 3
    ) -> np.ndarray:
        """
        Swipe feedback'e göre embedding güncelle.

        Args:
            session_id: Session ID
            user_name: User name
            initial_embedding: Original query embedding
            like_weight: Liked filmlere yaklaşma katsayısı
            dislike_weight: Disliked filmlerden uzaklaşma katsayısı
            min_swipes: Minimum swipe sayısı (bu kadar olmadan refine etme)

        Returns:
            Refined embedding (veya yeterli swipe yoksa original)
        """
        if session_id not in self.session_swipes:
            return initial_embedding

        if user_name not in self.session_swipes[session_id]:
            return initial_embedding

        swipes = self.session_swipes[session_id][user_name]

        # Yeterli swipe yoksa original dön
        if len(swipes) < min_swipes:
            return initial_embedding

        # Like ve dislike'ları ayır
        liked_ids = [s['movie_id'] for s in swipes if s['action'] == 'like']
        disliked_ids = [s['movie_id'] for s in swipes if s['action'] == 'dislike']

        # Embedding'leri al
        liked_embeddings = []
        for movie_id in liked_ids:
            emb = self._get_film_embedding(movie_id)
            if emb is not None:
                liked_embeddings.append(emb)

        disliked_embeddings = []
        for movie_id in disliked_ids:
            emb = self._get_film_embedding(movie_id)
            if emb is not None:
                disliked_embeddings.append(emb)

        # Centroid hesapla ve shift
        refined = initial_embedding.copy().astype(np.float64)

        if liked_embeddings:
            liked_centroid = np.mean(liked_embeddings, axis=0)
            refined = refined + like_weight * liked_centroid

        if disliked_embeddings:
            disliked_centroid = np.mean(disliked_embeddings, axis=0)
            refined = refined - dislike_weight * disliked_centroid

        # Normalize (cosine similarity için önemli)
        norm = np.linalg.norm(refined)
        if norm > 0:
            refined = refined / norm

        return refined

    def get_seen_films(self, session_id: str) -> List[int]:
        """
        Session'da görülen tüm filmlerin ID'leri.
        Bu filmler tekrar önerilmemeli.
        """
        if session_id not in self.session_swipes:
            return []

        seen = set()
        for user_swipes in self.session_swipes[session_id].values():
            for swipe in user_swipes:
                seen.add(swipe['movie_id'])

        return list(seen)

    def get_user_swipes(self, session_id: str, user_name: str) -> List[Dict]:
        """Belirli kullanıcının swipe'larını al"""
        if session_id not in self.session_swipes:
            return []
        if user_name not in self.session_swipes[session_id]:
            return []
        return self.session_swipes[session_id][user_name]

    def get_session_stats(self, session_id: str) -> Dict:
        """
        Debug için session istatistikleri.

        Returns:
            {
                user_name: {
                    "total": int,
                    "likes": int,
                    "dislikes": int,
                    "skips": int
                },
                ...
            }
        """
        if session_id not in self.session_swipes:
            return {}

        stats = {}
        for user_name, swipes in self.session_swipes[session_id].items():
            stats[user_name] = {
                'total': len(swipes),
                'likes': len([s for s in swipes if s['action'] == 'like']),
                'dislikes': len([s for s in swipes if s['action'] == 'dislike']),
                'skips': len([s for s in swipes if s['action'] == 'skip'])
            }

        return stats

    def clear_session(self, session_id: str) -> bool:
        """Session verilerini temizle"""
        if session_id in self.session_swipes:
            del self.session_swipes[session_id]
            return True
        return False

    def is_feedback_ready(self, session_id: str, user_name: str, min_swipes: int = 3) -> bool:
        """Kullanıcının yeterli swipe'ı var mı?"""
        swipes = self.get_user_swipes(session_id, user_name)
        return len(swipes) >= min_swipes

    def calculate_matches(self, session_id: str) -> Dict:
        """
        Calculate matches based on all user swipes.

        Match Algorithm:
        - Perfect Match: Everyone liked the movie (100%)
        - Majority Match: At least 75% liked (no veto)
        - Veto Rule: If anyone explicitly dislikes, no match

        Vote Actions:
        - 'like' = +1 vote for match
        - 'dislike' = VETO (blocks match)
        - 'skip' = neutral (doesn't count either way)

        Returns:
            {
                "perfect": [{"movie_id": int, "votes": {...}, "match_percentage": 100}],
                "majority": [{"movie_id": int, "votes": {...}, "match_percentage": float}]
            }
        """
        if session_id not in self.session_swipes:
            return {"perfect": [], "majority": []}

        # Get all users and their swipes
        all_users = list(self.session_swipes[session_id].keys())
        user_count = len(all_users)

        if user_count == 0:
            return {"perfect": [], "majority": []}

        # Collect all movie_ids that were swiped
        all_movie_ids = set()
        for user_swipes in self.session_swipes[session_id].values():
            for swipe in user_swipes:
                all_movie_ids.add(swipe['movie_id'])

        perfect = []
        majority = []

        for movie_id in all_movie_ids:
            votes = {}
            like_count = 0
            has_veto = False
            voters_count = 0

            for user_name in all_users:
                user_swipes = self.session_swipes[session_id].get(user_name, [])
                swipe = next((s for s in user_swipes if s['movie_id'] == movie_id), None)

                if swipe:
                    action = swipe['action']
                    votes[user_name] = action

                    if action == 'like':
                        like_count += 1
                        voters_count += 1
                    elif action == 'dislike':
                        has_veto = True
                        voters_count += 1
                    # skip doesn't count as voter

            # Skip if vetoed (someone disliked)
            if has_veto:
                continue

            # Need at least one like to consider it a match
            if like_count == 0:
                continue

            # Calculate match percentage (likes / total users)
            percentage = (like_count / user_count) * 100

            # Perfect match: everyone liked
            if like_count == user_count:
                perfect.append({
                    "movie_id": movie_id,
                    "votes": votes,
                    "match_percentage": 100
                })
            # Majority match: 75%+ liked
            elif percentage >= 75:
                majority.append({
                    "movie_id": movie_id,
                    "votes": votes,
                    "match_percentage": round(percentage, 1),
                    "liked_count": like_count,
                    "total_voters": voters_count
                })

        return {"perfect": perfect, "majority": majority}
