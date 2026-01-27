from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai.gateway import ModelGateway
from ai.types import (
    GatewayRequest, GatewayResponse,
    SwipeRequest, SwipeResponse, SessionStatsResponse, MatchesResponse
)
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()


@asynccontextmanager
async def lifespan(app):
    # Seed ChromaDB on startup if empty
    from startup import seed_if_empty
    seed_if_empty()
    yield


app = FastAPI(title="CineMatch Recommendation API", lifespan=lifespan)

# CORS - get request from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model gateway once (includes feedback learner)
gateway = ModelGateway()

@app.post('/recommendations', response_model=GatewayResponse, response_model_exclude_none=False)
def recommend_movies(request: GatewayRequest):
    """
    Grup için film önerisi al.

    session_id verilirse feedback-aware recommendation yapılır:
    - Görülen filmler exclude edilir
    - Swipe verilerine göre embedding'ler refine edilir
    - Round 2+ ise swipe history LLM'e gönderilir

    Request body:
    {
        "participants": [
            {"name": "Ahmet", "moods": ["funny", "relaxed"], "note": "no horror"},
            {"name": "Ayşe", "moods": ["romantic", "emotional"]}
        ],
        "num_recommendations": 5,
        "session_id": "abc123",  // Opsiyonel - feedback için
        "round": 1  // 1 = ilk tur, 2+ = "10 More Movies" sonrası
    }
    """
    # Eğer session_id varsa feedback-aware recommendation yap
    if request.session_id:
        # Debug logging
        seen_films = gateway.get_seen_films(request.session_id)
        stats = gateway.get_session_stats(request.session_id)
        print(f"\n[CineMatch] Feedback-aware recommendation request:")
        print(f"  - session_id: {request.session_id}")
        print(f"  - round: {request.round}")
        print(f"  - seen_films count: {len(seen_films)}")
        print(f"  - seen_films: {seen_films[:10]}..." if len(seen_films) > 10 else f"  - seen_films: {seen_films}")
        print(f"  - user stats: {stats}")

        return gateway.recommend_with_feedback(
            participants=request.participants,
            session_id=request.session_id,
            num_recommendations=request.num_recommendations,
            round_num=request.round
        )

    # Yoksa normal recommendation
    return gateway.recommend(
        participants=request.participants,
        num_recommendations=request.num_recommendations
    )

@app.get("/health")
def health_check():
    return {"status": "ok"}


# ============ Swipe Feedback Endpoints ============

@app.post('/swipe', response_model=SwipeResponse)
def record_swipe(request: SwipeRequest):
    """
    Kullanıcı swipe'ını kaydet (online learning için).

    Request body:
    {
        "session_id": "abc123",
        "user_name": "Ahmet",
        "movie_id": 12345,
        "action": "like"  // "like", "dislike", "skip"
    }
    """
    print(f"[CineMatch] Recording swipe: session={request.session_id}, user={request.user_name}, movie={request.movie_id}, action={request.action.value}")

    result = gateway.record_swipe(
        session_id=request.session_id,
        user_name=request.user_name,
        movie_id=request.movie_id,
        action=request.action.value
    )

    print(f"[CineMatch] Swipe recorded: total_swipes={result['total_swipes']}, feedback_ready={result.get('feedback_ready', False)}")

    return SwipeResponse(
        recorded=result["recorded"],
        total_swipes=result["total_swipes"],
        feedback_ready=result.get("feedback_ready", False)
    )


@app.get('/session/{session_id}/stats', response_model=SessionStatsResponse)
def get_session_stats(session_id: str):
    """
    Session swipe istatistiklerini al.

    Returns:
    {
        "session_id": "abc123",
        "stats": {
            "Ahmet": {"total": 10, "likes": 6, "dislikes": 3, "skips": 1},
            "Ayşe": {"total": 8, "likes": 5, "dislikes": 2, "skips": 1}
        },
        "seen_films": [123, 456, 789, ...]
    }
    """
    stats = gateway.get_session_stats(session_id)
    seen_films = gateway.get_seen_films(session_id)

    return SessionStatsResponse(
        session_id=session_id,
        stats=stats,
        seen_films=seen_films
    )


@app.delete('/session/{session_id}')
def clear_session(session_id: str):
    """Session swipe verilerini temizle"""
    cleared = gateway.clear_session(session_id)
    return {"cleared": cleared, "session_id": session_id}


@app.get('/session/{session_id}/matches', response_model=MatchesResponse)
def get_session_matches(session_id: str):
    """
    Calculate and return matches for a session.

    Uses backend swipe data to determine group matches:
    - Perfect Match (100%): Everyone liked the movie
    - Majority Match (75%+): At least 75% liked (no veto)
    - Veto Rule: If anyone explicitly dislikes, no match

    Returns:
    {
        "session_id": "abc123",
        "user_count": 2,
        "matches": {
            "perfect": [{"movie_id": 123, "title": "Inception", "votes": {...}, ...}],
            "majority": [{"movie_id": 456, "title": "Interstellar", "votes": {...}, ...}]
        },
        "no_match_count": 5
    }
    """
    # Get match calculations
    matches = gateway.calculate_matches(session_id)

    # Get user count and seen films
    stats = gateway.get_session_stats(session_id)
    user_count = len(stats)
    seen_films = gateway.get_seen_films(session_id)
    seen_count = len(seen_films)

    # Calculate no match count
    perfect_count = len(matches.get("perfect", []))
    majority_count = len(matches.get("majority", []))
    no_match_count = seen_count - perfect_count - majority_count

    return MatchesResponse(
        session_id=session_id,
        user_count=user_count,
        matches=matches,
        no_match_count=max(0, no_match_count)
    )


@app.get('/evaluate')
def run_evaluation():
    """
    Run the evaluation pipeline and return metrics.

    GET /evaluate

    Returns evaluation results including:
    - Consistency scores
    - Genre alignment scores
    - Diversity metrics
    - Fairness metrics
    """
    from ml.evaluation import RecommendationEvaluator

    evaluator = RecommendationEvaluator(gateway.fair_recommender)
    results = evaluator.run_full_evaluation(verbose=True)
    return results