"""
Group Fairness Module - Least Misery Approach

Her kullanıcı için ayrı embedding query yapıp,
fairness-aware birleştirme ile adil öneriler sunar.

Part 2: Feedback Loop entegrasyonu ile swipe verilerinden öğrenme.
"""

import numpy as np
from typing import List, Dict, Optional, TYPE_CHECKING
from ml.embeddings import EmbeddingEngine

if TYPE_CHECKING:
    from ml.feedback_learner import FeedbackLearner


class FairGroupRecommender:
    """
    Fairness-aware group recommendation using Least Misery approach.

    fair_score = (1 - fairness_weight) * average + fairness_weight * minimum

    Bu yaklaşım herkesin en az biraz memnun olacağı filmleri seçer.
    """

    def __init__(self, embedding_engine: EmbeddingEngine):
        self.embedding_engine = embedding_engine

    # Mood → Semantic expansion map
    # Embedding search'de daha iyi sonuçlar almak için
    # soyut mood kelimelerini film açıklamalarına yakın terimlerle zenginleştiriyoruz
    MOOD_EXPANSION = {
        'uplifting': 'uplifting feel-good heartwarming inspiring positive comedy family',
        'nostalgic': 'nostalgic classic retro coming-of-age childhood memories drama romance',
        'cozy': 'cozy warm comfort feel-good light-hearted family comedy romance',
        'mind-bending': 'mind-bending complex twist puzzle science fiction mystery thriller',
        'dark': 'dark gritty noir disturbing crime horror thriller',
        'emotional': 'emotional moving tearjerker heartbreaking drama romance',
        'adventurous': 'adventurous epic journey quest exploration adventure action fantasy',
        'relaxed': 'relaxed easy-going laid-back light comedy drama feel-good',
        'intense': 'intense gripping suspenseful high-stakes action thriller crime',
        'thrilling': 'thrilling suspenseful edge-of-seat tension thriller action horror',
        'romantic': 'romantic love story relationship passion romance drama',
        'funny': 'funny hilarious comedy humor laugh entertaining',
    }

    def build_query(self, moods: List[str], note: str = "") -> str:
        """
        Mood ve note'dan zenginleştirilmiş query string oluştur.

        Soyut mood kelimeleri, embedding space'de film açıklamalarıyla
        iyi eşleşmeyebilir. Bu yüzden her mood'u semantik olarak
        genişletiyoruz.

        Örnek:
            "uplifting" → "uplifting feel-good heartwarming inspiring positive comedy family"
        """
        # Mood'ları semantik olarak genişlet
        expanded_moods = []
        for mood in (moods or []):
            expanded = self.MOOD_EXPANSION.get(mood, mood)
            expanded_moods.append(expanded)

        mood_text = " ".join(expanded_moods) if expanded_moods else ""
        note_text = note.strip() if note else ""
        return f"{mood_text} {note_text}".strip()

    def get_user_candidates(self, query: str, n_results: int = 30) -> Dict[int, float]:
        """
        Tek kullanıcı için candidate filmler ve similarity skorları.

        Returns:
            Dict[movie_id, similarity_score]
        """
        if not query:
            return {}

        results = self.embedding_engine.search_similar_movies(query, top_k=n_results)

        candidates = {}
        for movie in results:
            candidates[movie["id"]] = movie["similarity"]

        return candidates

    def recommend_fair(
        self,
        participants: List[Dict],
        n_candidates: int = 30,
        n_results: int = 30,
        fairness_weight: float = 0.5
    ) -> List[Dict]:
        """
        Fairness-aware group recommendation.

        Args:
            participants: [{"name": str, "moods": List[str], "note": str}, ...]
            n_candidates: Her kullanıcı için kaç candidate çekilecek
            n_results: Final kaç film döndürülecek
            fairness_weight: 0=pure average, 1=pure least misery

        Returns:
            [{
                "movie_id": int,
                "fair_score": float,
                "avg_score": float,
                "min_score": float,
                "individual_scores": {user_name: score, ...}
            }, ...]
        """

        # SOLO MODE: Tek kişiyse fairness hesaplama, direkt dön
        if len(participants) == 1:
            user = participants[0]
            query = self.build_query(
                user.get("moods", []),
                user.get("note", "")
            )
            candidates = self.get_user_candidates(query, n_candidates)

            user_name = user.get("name", "User")
            return [
                {
                    "movie_id": movie_id,
                    "fair_score": score,
                    "avg_score": score,
                    "min_score": score,
                    "individual_scores": {user_name: score}
                }
                for movie_id, score in sorted(
                    candidates.items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:n_results]
            ]

        # GROUP MODE: Her kullanıcı için ayrı candidate çek
        all_candidates: Dict[int, Dict[str, float]] = {}  # movie_id -> {user_name: score}

        for user in participants:
            user_name = user.get("name", "User")
            query = self.build_query(
                user.get("moods", []),
                user.get("note", "")
            )

            user_candidates = self.get_user_candidates(query, n_candidates)

            for movie_id, score in user_candidates.items():
                if movie_id not in all_candidates:
                    all_candidates[movie_id] = {}
                all_candidates[movie_id][user_name] = score

        # Fairness skoru hesapla
        scored_films = []
        user_names = [u.get("name", f"User{i}") for i, u in enumerate(participants)]

        for movie_id, user_scores in all_candidates.items():
            # Her kullanıcının skoru (yoksa 0)
            scores = [user_scores.get(name, 0.0) for name in user_names]

            avg_score = float(np.mean(scores))
            min_score = float(min(scores))

            # Least Misery formula
            fair_score = (1 - fairness_weight) * avg_score + fairness_weight * min_score

            scored_films.append({
                "movie_id": movie_id,
                "fair_score": fair_score,
                "avg_score": avg_score,
                "min_score": min_score,
                "individual_scores": user_scores
            })

        # Fair score'a göre sırala
        scored_films.sort(key=lambda x: x["fair_score"], reverse=True)

        return scored_films[:n_results]

    def get_fairness_stats(self, recommendations: List[Dict], participants: List[Dict]) -> Dict:
        """
        Öneri listesinin fairness istatistiklerini hesapla.

        Returns:
            {
                "overall_fairness": float (0-1),
                "user_satisfaction": {user_name: avg_score, ...},
                "least_satisfied": user_name,
                "most_satisfied": user_name
            }
        """
        if not recommendations or not participants:
            return {}

        user_names = [u.get("name", f"User{i}") for i, u in enumerate(participants)]

        # Her kullanıcının ortalama memnuniyeti
        user_totals = {name: [] for name in user_names}

        for rec in recommendations:
            for name in user_names:
                score = rec.get("individual_scores", {}).get(name, 0.0)
                user_totals[name].append(score)

        user_satisfaction = {
            name: float(np.mean(scores)) if scores else 0.0
            for name, scores in user_totals.items()
        }

        # En az ve en çok memnun olan
        sorted_users = sorted(user_satisfaction.items(), key=lambda x: x[1])
        least_satisfied = sorted_users[0][0] if sorted_users else None
        most_satisfied = sorted_users[-1][0] if sorted_users else None

        # Overall fairness (1 - variance between user satisfactions)
        if len(user_satisfaction) > 1:
            variance = float(np.var(list(user_satisfaction.values())))
            overall_fairness = max(0.0, 1.0 - variance * 10)  # Scale variance
        else:
            overall_fairness = 1.0

        return {
            "overall_fairness": overall_fairness,
            "user_satisfaction": user_satisfaction,
            "least_satisfied": least_satisfied,
            "most_satisfied": most_satisfied
        }

    def recommend_fair_with_feedback(
        self,
        participants: List[Dict],
        session_id: str,
        feedback_learner: "FeedbackLearner",
        n_candidates: int = 30,
        n_results: int = 30,
        fairness_weight: float = 0.5
    ) -> List[Dict]:
        """
        Feedback-aware fairness recommendation.

        Swipe verilerini kullanarak:
        1. Görülen filmleri exclude eder
        2. Her kullanıcının embedding'ini swipe'lara göre refine eder
        3. Fairness hesabı yapar

        Args:
            participants: [{"name": str, "moods": List[str], "note": str}, ...]
            session_id: Session ID for feedback lookup
            feedback_learner: FeedbackLearner instance
            n_candidates: Her kullanıcı için kaç candidate çekilecek
            n_results: Final kaç film döndürülecek
            fairness_weight: 0=pure average, 1=pure least misery

        Returns:
            [{
                "movie_id": int,
                "fair_score": float,
                "avg_score": float,
                "min_score": float,
                "individual_scores": {user_name: score, ...},
                "feedback_applied": bool
            }, ...]
        """
        # Görülen filmleri al (exclude için)
        seen_films = set(feedback_learner.get_seen_films(session_id))

        # SOLO MODE
        if len(participants) == 1:
            user = participants[0]
            user_name = user.get("name", "User")
            query = self.build_query(
                user.get("moods", []),
                user.get("note", "")
            )

            # Original embedding
            original_embedding = np.array(
                self.embedding_engine.embed_query(query)
            )

            # Feedback varsa refine et
            feedback_applied = feedback_learner.is_feedback_ready(session_id, user_name)
            if feedback_applied:
                refined_embedding = feedback_learner.get_refined_embedding(
                    session_id=session_id,
                    user_name=user_name,
                    initial_embedding=original_embedding
                )
            else:
                refined_embedding = original_embedding

            # Query with refined embedding
            results = self.embedding_engine.vector_store.query_similar_movies(
                refined_embedding.tolist(),
                n_results=n_candidates + len(seen_films)
            )

            # Filter seen films
            filtered_results = [
                r for r in results
                if r["id"] not in seen_films
            ][:n_results]

            return [
                {
                    "movie_id": movie["id"],
                    "fair_score": movie["similarity"],
                    "avg_score": movie["similarity"],
                    "min_score": movie["similarity"],
                    "individual_scores": {user_name: movie["similarity"]},
                    "feedback_applied": feedback_applied
                }
                for movie in filtered_results
            ]

        # GROUP MODE: Her kullanıcı için feedback-aware query
        all_candidates: Dict[int, Dict[str, float]] = {}
        any_feedback_applied = False

        for user in participants:
            user_name = user.get("name", "User")
            query = self.build_query(
                user.get("moods", []),
                user.get("note", "")
            )

            # Original embedding
            original_embedding = np.array(
                self.embedding_engine.embed_query(query)
            )

            # Feedback varsa refine et
            user_feedback_ready = feedback_learner.is_feedback_ready(session_id, user_name)
            if user_feedback_ready:
                any_feedback_applied = True
                refined_embedding = feedback_learner.get_refined_embedding(
                    session_id=session_id,
                    user_name=user_name,
                    initial_embedding=original_embedding
                )
            else:
                refined_embedding = original_embedding

            # Query with refined embedding
            results = self.embedding_engine.vector_store.query_similar_movies(
                refined_embedding.tolist(),
                n_results=n_candidates + len(seen_films)
            )

            for movie in results:
                movie_id = movie["id"]
                if movie_id in seen_films:
                    continue

                if movie_id not in all_candidates:
                    all_candidates[movie_id] = {}
                all_candidates[movie_id][user_name] = movie["similarity"]

        # Fairness skoru hesapla
        scored_films = []
        user_names = [u.get("name", f"User{i}") for i, u in enumerate(participants)]

        for movie_id, user_scores in all_candidates.items():
            scores = [user_scores.get(name, 0.0) for name in user_names]

            avg_score = float(np.mean(scores))
            min_score = float(min(scores))

            # Least Misery formula
            fair_score = (1 - fairness_weight) * avg_score + fairness_weight * min_score

            scored_films.append({
                "movie_id": movie_id,
                "fair_score": fair_score,
                "avg_score": avg_score,
                "min_score": min_score,
                "individual_scores": user_scores,
                "feedback_applied": any_feedback_applied
            })

        # Fair score'a göre sırala
        scored_films.sort(key=lambda x: x["fair_score"], reverse=True)

        return scored_films[:n_results]
