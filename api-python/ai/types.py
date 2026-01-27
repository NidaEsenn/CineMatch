from enum import Enum
from pydantic import BaseModel
from typing import Optional

class ModelProvider(str, Enum):
    GROQ = "groq"
    DEEPSEEK = "deepseek" 
    ANTHROPIC = "anthropic"
    EMBEDDING_ONLY ="embedding_only"


#it accepts json file with pydantic model otomatically converted 
class ParticipantPreference(BaseModel):
    """One person's movie preferences"""
    name: str
    moods: list[str] 
    note: Optional[str] = None #additional notes from the participant 
 

class GatewayRequest(BaseModel):
    """Request to the Model Gateway"""
    participants: list[ParticipantPreference]  # holds all participants
    num_recommendations: int  # number of movie recommendations to return
    session_id: Optional[str] = None  # Optional session ID for feedback-aware recommendations
    round: int = 1  # Which round (1 = first, 2+ = after "more movies")
   
#it shows single movie after match for all participants
class MovieRecommendation(BaseModel):
    """A single movie recommendation with full details"""
    id: int
    title: str
    why: str  # why this matches the group
    poster_url: Optional[str] = None
    overview: Optional[str] = None
    vote_average: Optional[float] = None
    release_year: Optional[str] = None
    genres: list[str] = []
    trailer_key: Optional[str] = None  # YouTube video ID

class FairnessStats(BaseModel):
    """Fairness statistics for group recommendations"""
    overall_fairness: float  # 0-1, higher = more fair
    user_satisfaction: dict[str, float]  # {user_name: avg_satisfaction}
    least_satisfied: Optional[str] = None
    most_satisfied: Optional[str] = None


class GatewayResponse(BaseModel):
    """Response from the Model Gateway"""
    recommendations: list[MovieRecommendation]
    model_used: ModelProvider
    response_time_ms: int = 0
    cost_usd: float = 0.0
    fairness_applied: bool = False  # True if group fairness was used
    fairness_stats: Optional[FairnessStats] = None  # Stats when fairness applied
    feedback_applied: bool = False  # True if swipe feedback was used
    round: int = 1  # Which round of recommendations
    seen_count: int = 0  # Number of movies already seen in this session


# Swipe Feedback Types
class SwipeAction(str, Enum):
    LIKE = "like"
    DISLIKE = "dislike"
    SKIP = "skip"


class SwipeRequest(BaseModel):
    """Request to record a swipe"""
    session_id: str
    user_name: str
    movie_id: int
    action: SwipeAction


class SwipeResponse(BaseModel):
    """Response after recording a swipe"""
    recorded: bool
    total_swipes: int
    feedback_ready: bool  # True if enough swipes for refinement


class SessionStatsResponse(BaseModel):
    """Session swipe statistics"""
    session_id: str
    stats: dict  # {user_name: {total, likes, dislikes, skips}}
    seen_films: list[int]


# Match Types
class MovieMatch(BaseModel):
    """A single movie match with vote details"""
    movie_id: int
    title: Optional[str] = None
    poster_url: Optional[str] = None
    votes: dict[str, str]  # {user_name: action}
    match_percentage: float
    liked_count: Optional[int] = None
    total_voters: Optional[int] = None


class MatchesResponse(BaseModel):
    """Response for session matches calculation"""
    session_id: str
    user_count: int
    matches: dict  # {"perfect": [MovieMatch], "majority": [MovieMatch]}
    no_match_count: int