import time
from typing import Optional
from .types import GatewayResponse, ParticipantPreference, MovieRecommendation, ModelProvider, FairnessStats
from .groq_client import GroqClient
from ml.embeddings import EmbeddingEngine
from ml.group_fairness import FairGroupRecommender
from ml.feedback_learner import FeedbackLearner
from data.movie_repository import MovieRepository


class ModelGateway:
    '''
    Hybrid model gateway with Group Fairness (Least Misery) + Feedback Loop

    Flow:
    1. Her kullanıcı için ayrı embedding query
    2. Swipe feedback varsa embedding'leri refine et
    3. Fairness-aware birleştirme (0.6*avg + 0.4*min)
    4. Groq LLM ile final ranking
    5. Fallback: sadece fairness sonuçları
    '''

    def __init__(self):
        self.embedding_engine = EmbeddingEngine()
        self.movie_repo = MovieRepository("data/movies.json")
        self.groq = GroqClient()
        # Fairness-aware recommender
        self.fair_recommender = FairGroupRecommender(self.embedding_engine)
        # Feedback learner for online learning
        self.feedback_learner = FeedbackLearner(self.embedding_engine)

    def recommend(
        self,
        participants: list[ParticipantPreference],
        num_recommendations: int = 10
    ) -> GatewayResponse:
        start_time = time.time()

        # Convert Pydantic models to dicts for fairness module
        participants_dict = [
            {
                "name": p.name,
                "moods": p.moods,
                "note": p.note or ""
            }
            for p in participants
        ]

        # Get fair candidates (her kullanıcı için ayrı query + fairness birleştirme)
        fair_candidates = self.fair_recommender.recommend_fair(
            participants=participants_dict,
            n_candidates=30,
            n_results=30,
            fairness_weight=0.4  # 0=pure avg, 1=pure least misery
        )

        # Get full movie details for fair candidates
        movie_ids = [c["movie_id"] for c in fair_candidates]
        full_movies = self.movie_repo.get_movies_by_ids(movie_ids)

        # Add fairness scores to full movie details
        for movie in full_movies:
            for c in fair_candidates:
                if c["movie_id"] == movie["id"]:
                    movie["similarity"] = c["fair_score"]
                    movie["fair_score"] = c["fair_score"]
                    movie["avg_score"] = c["avg_score"]
                    movie["min_score"] = c["min_score"]
                    movie["individual_scores"] = c["individual_scores"]
                    break

        # Send to LLM for final ranking
        try:
            recommendations = self.groq.recommend_from_candidates_movies(
                participants,
                full_movies,
                num_recommendations
            )
            model_used = ModelProvider.GROQ

        except Exception as e:
            print(f"Groq failed with error: {e}, falling back to fairness-only results")
            # Fallback: Use fairness results directly
            recommendations = []
            for movie in full_movies[:num_recommendations]:
                individual = movie.get("individual_scores", {})
                why_parts = []
                for name, score in individual.items():
                    pct = int(score * 100)
                    why_parts.append(f"{name}: {pct}%")
                why = f"Fair match - {', '.join(why_parts)}" if why_parts else "Recommended based on group preferences"

                recommendations.append(MovieRecommendation(
                    id=movie["id"],
                    title=movie["title"],
                    why=why,
                    poster_url=movie.get("poster_url"),
                    overview=movie.get("overview"),
                    vote_average=movie.get("vote_average"),
                    release_year=movie.get("release_year"),
                    genres=movie.get("genres", []),
                    trailer_key=movie.get("trailer_key")
                ))
            model_used = ModelProvider.EMBEDDING_ONLY

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Get fairness stats and convert to Pydantic model
        fairness_stats_dict = self.fair_recommender.get_fairness_stats(
            fair_candidates[:num_recommendations],
            participants_dict
        )

        fairness_stats = None
        if len(participants) > 1 and fairness_stats_dict:
            fairness_stats = FairnessStats(
                overall_fairness=fairness_stats_dict.get("overall_fairness", 0.0),
                user_satisfaction=fairness_stats_dict.get("user_satisfaction", {}),
                least_satisfied=fairness_stats_dict.get("least_satisfied"),
                most_satisfied=fairness_stats_dict.get("most_satisfied")
            )

        return GatewayResponse(
            recommendations=recommendations,
            model_used=model_used,
            response_time_ms=elapsed_ms,
            cost_usd=0.0,
            fairness_applied=len(participants) > 1,
            fairness_stats=fairness_stats,
            feedback_applied=False
        )

    def recommend_with_feedback(
        self,
        participants: list[ParticipantPreference],
        session_id: str,
        num_recommendations: int = 10,
        round_num: int = 1
    ) -> GatewayResponse:
        """
        Feedback-aware recommendation.
        Swipe verilerini kullanarak embedding'leri refine eder.

        Args:
            participants: List of participant preferences
            session_id: Session ID for feedback lookup
            num_recommendations: Number of recommendations to return
            round_num: Which round (1 = first, 2+ = with feedback)
        """
        start_time = time.time()

        # Convert Pydantic models to dicts
        participants_dict = [
            {
                "name": p.name,
                "moods": p.moods,
                "note": p.note or ""
            }
            for p in participants
        ]

        # Get seen films count
        seen_films = self.feedback_learner.get_seen_films(session_id)
        seen_count = len(seen_films)

        # Get fair candidates WITH feedback integration
        fair_candidates = self.fair_recommender.recommend_fair_with_feedback(
            participants=participants_dict,
            session_id=session_id,
            feedback_learner=self.feedback_learner,
            n_candidates=30,
            n_results=30,
            fairness_weight=0.4
        )

        # Check if feedback was applied
        feedback_applied = any(c.get("feedback_applied", False) for c in fair_candidates)

        # Get full movie details
        movie_ids = [c["movie_id"] for c in fair_candidates]
        full_movies = self.movie_repo.get_movies_by_ids(movie_ids)

        # Add scores to movies
        for movie in full_movies:
            for c in fair_candidates:
                if c["movie_id"] == movie["id"]:
                    movie["similarity"] = c["fair_score"]
                    movie["fair_score"] = c["fair_score"]
                    movie["avg_score"] = c["avg_score"]
                    movie["min_score"] = c["min_score"]
                    movie["individual_scores"] = c["individual_scores"]
                    break

        # Build swipe history for Groq prompt (round 2+)
        swipe_history = None
        if round_num > 1:
            swipe_history = self._build_swipe_history(session_id, participants_dict)

        # Send to LLM for final ranking
        try:
            recommendations = self.groq.recommend_from_candidates_movies(
                participants,
                full_movies,
                num_recommendations,
                swipe_history=swipe_history,
                round_num=round_num
            )
            model_used = ModelProvider.GROQ

        except Exception as e:
            print(f"Groq failed with error: {e}, falling back to fairness-only results")
            recommendations = []
            for movie in full_movies[:num_recommendations]:
                individual = movie.get("individual_scores", {})
                why_parts = []
                for name, score in individual.items():
                    pct = int(score * 100)
                    why_parts.append(f"{name}: {pct}%")
                why = f"Fair match - {', '.join(why_parts)}" if why_parts else "Recommended based on group preferences"

                recommendations.append(MovieRecommendation(
                    id=movie["id"],
                    title=movie["title"],
                    why=why,
                    poster_url=movie.get("poster_url"),
                    overview=movie.get("overview"),
                    vote_average=movie.get("vote_average"),
                    release_year=movie.get("release_year"),
                    genres=movie.get("genres", []),
                    trailer_key=movie.get("trailer_key")
                ))
            model_used = ModelProvider.EMBEDDING_ONLY

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Get fairness stats
        fairness_stats_dict = self.fair_recommender.get_fairness_stats(
            fair_candidates[:num_recommendations],
            participants_dict
        )

        fairness_stats = None
        if len(participants) > 1 and fairness_stats_dict:
            fairness_stats = FairnessStats(
                overall_fairness=fairness_stats_dict.get("overall_fairness", 0.0),
                user_satisfaction=fairness_stats_dict.get("user_satisfaction", {}),
                least_satisfied=fairness_stats_dict.get("least_satisfied"),
                most_satisfied=fairness_stats_dict.get("most_satisfied")
            )

        return GatewayResponse(
            recommendations=recommendations,
            model_used=model_used,
            response_time_ms=elapsed_ms,
            cost_usd=0.0,
            fairness_applied=len(participants) > 1,
            fairness_stats=fairness_stats,
            feedback_applied=feedback_applied,
            round=round_num,
            seen_count=seen_count
        )

    def _build_swipe_history(self, session_id: str, participants: list[dict]) -> dict:
        """
        Build swipe history for Groq prompt.

        Returns:
            {user_name: {"likes": [titles], "dislikes": [titles]}}
        """
        swipe_history = {}

        for user in participants:
            user_name = user.get("name", "User")
            swipes = self.feedback_learner.get_user_swipes(session_id, user_name)

            if not swipes:
                continue

            liked_ids = [s["movie_id"] for s in swipes if s["action"] == "like"]
            disliked_ids = [s["movie_id"] for s in swipes if s["action"] == "dislike"]

            # Get movie titles for context
            liked_titles = []
            for movie_id in liked_ids[:5]:  # Limit to 5 for prompt size
                movie = self.movie_repo.get_movie_by_id(movie_id)
                if movie:
                    liked_titles.append(movie.get("title", str(movie_id)))

            disliked_titles = []
            for movie_id in disliked_ids[:5]:
                movie = self.movie_repo.get_movie_by_id(movie_id)
                if movie:
                    disliked_titles.append(movie.get("title", str(movie_id)))

            if liked_titles or disliked_titles:
                swipe_history[user_name] = {
                    "likes": liked_titles,
                    "dislikes": disliked_titles
                }

        return swipe_history

    # ============ Feedback Management Methods ============

    def record_swipe(
        self,
        session_id: str,
        user_name: str,
        movie_id: int,
        action: str
    ) -> dict:
        """Swipe kaydı yap"""
        result = self.feedback_learner.record_swipe(
            session_id=session_id,
            user_name=user_name,
            movie_id=movie_id,
            action=action
        )
        # Add feedback_ready flag
        result["feedback_ready"] = self.feedback_learner.is_feedback_ready(
            session_id, user_name
        )
        return result

    def get_session_stats(self, session_id: str) -> dict:
        """Session swipe istatistiklerini al"""
        return self.feedback_learner.get_session_stats(session_id)

    def get_seen_films(self, session_id: str) -> list[int]:
        """Session'da görülen filmleri al"""
        return self.feedback_learner.get_seen_films(session_id)

    def clear_session(self, session_id: str) -> bool:
        """Session verilerini temizle"""
        return self.feedback_learner.clear_session(session_id)

    def calculate_matches(self, session_id: str) -> dict:
        """
        Calculate matches for a session and enrich with movie details.

        Returns:
            {
                "perfect": [{"movie_id": int, "title": str, "poster_url": str, ...}],
                "majority": [{"movie_id": int, "title": str, "poster_url": str, ...}]
            }
        """
        # Get raw match data from feedback learner
        raw_matches = self.feedback_learner.calculate_matches(session_id)

        # Enrich with movie details
        enriched = {"perfect": [], "majority": []}

        for match in raw_matches.get("perfect", []):
            movie = self.movie_repo.get_movie_by_id(match["movie_id"])
            if movie:
                enriched["perfect"].append({
                    **match,
                    "title": movie.get("title"),
                    "poster_url": movie.get("poster_url"),
                    "overview": movie.get("overview"),
                    "vote_average": movie.get("vote_average"),
                    "genres": movie.get("genres", []),
                    "trailer_key": movie.get("trailer_key")
                })

        for match in raw_matches.get("majority", []):
            movie = self.movie_repo.get_movie_by_id(match["movie_id"])
            if movie:
                enriched["majority"].append({
                    **match,
                    "title": movie.get("title"),
                    "poster_url": movie.get("poster_url"),
                    "overview": movie.get("overview"),
                    "vote_average": movie.get("vote_average"),
                    "genres": movie.get("genres", []),
                    "trailer_key": movie.get("trailer_key")
                })

        return enriched
