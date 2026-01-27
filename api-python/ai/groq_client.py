import os
from groq import Groq
from .types import ParticipantPreference, MovieRecommendation
import json
class GroqClient:

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client= Groq(api_key=self.api_key)
        self.movies = self._load_movies()

    def _load_movies(self) -> list[dict]:
        """Load movie dataset from a local JSON file"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        movies_path = os.path.join(current_dir, "..", "data", "movies.json")
        with open(movies_path, "r", encoding="utf-8") as f:
            return json.load(f)


    def recommend_from_candidates_movies(
        self,
        participants: list[ParticipantPreference],
        candidate_movies,
        num_recommendations: int = 10,
        swipe_history: dict | None = None,
        round_num: int = 1
    ) -> list[MovieRecommendation]:
        """
        Make suggestion based on vector search candidates.

        Args:
            participants: List of participant preferences
            candidate_movies: List of candidate movies from embedding search
            num_recommendations: Number of recommendations to return
            swipe_history: Optional swipe history for feedback-aware recommendations
                          Format: {user_name: {"likes": [titles], "dislikes": [titles]}}
            round_num: Which round of recommendations (1 = first, 2+ = with feedback)
        """
        prompt = self._build_prompt_with_candidates(
            participants, candidate_movies, num_recommendations,
            swipe_history=swipe_history, round_num=round_num
        )
        response = self.client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.7
        )
        content = response.choices[0].message.content
        if content is None:
            return []
        recommendations = self._parse_response(content)
        return recommendations
        
        

    # Mood definitions for better LLM understanding
    MOOD_DEFINITIONS = {
        "funny": "Comedy genre, lighthearted humor, makes you laugh. MUST be Comedy genre.",
        "romantic": "Romance genre, love stories, relationships, emotional connections.",
        "uplifting": "Feel-good movies, positive endings, inspiring stories.",
        "dark": "Serious tone, psychological depth, noir, morally complex. NOT necessarily horror.",
        "nostalgic": "Classic films, beloved older movies (pre-2010), timeless stories.",
        "mind-bending": "Plot twists, reality-bending, puzzle narratives, cerebral. Sci-fi thrillers.",
        "exciting": "Action-packed, thrilling, adrenaline rush. Action/Adventure genre.",
        "relaxed": "Easy-to-watch, comfort movies, low-stress viewing.",
        "emotional": "Drama that makes you feel deeply, tearjerkers, moving stories.",
        "thrilling": "Suspenseful, keeps you on edge. Thriller genre.",
        "scary": "Horror genre, frightening, supernatural or psychological terror.",
        "adventurous": "Epic journeys, exploration, Adventure genre.",
        "thought-provoking": "Makes you think, philosophical themes, deep meaning.",
        "heartwarming": "Sweet, touching stories that warm your heart.",
    }

    # Genre preferences for each mood
    MOOD_GENRE_PREFERENCES = {
        "funny": ["Comedy"],
        "romantic": ["Romance"],
        "uplifting": ["Comedy", "Drama", "Family"],
        "dark": ["Drama", "Thriller", "Crime", "Mystery"],
        "nostalgic": [],  # No specific genre, just older films
        "mind-bending": ["Science Fiction", "Thriller", "Mystery"],
        "exciting": ["Action", "Adventure"],
        "relaxed": ["Comedy", "Family", "Animation"],
        "emotional": ["Drama", "Romance"],
        "thrilling": ["Thriller", "Action", "Crime"],
        "scary": ["Horror", "Thriller"],
        "adventurous": ["Adventure", "Action", "Fantasy"],
        "thought-provoking": ["Drama", "Science Fiction"],
        "heartwarming": ["Drama", "Comedy", "Family", "Romance"],
    }

    def _build_prompt_with_candidates(
        self,
        participants: list[ParticipantPreference],
        candidate_movies: list[dict],
        num_recommendations: int,
        swipe_history: dict | None = None,
        round_num: int = 1
    ) -> str:
        """Build prompt with optional swipe history for feedback-aware recommendations."""
        # Only include movies that have trailers
        movies_with_trailers = [m for m in candidate_movies if m.get('trailer_key')]

        # Collect all moods from participants
        all_moods = set()
        for p in participants:
            all_moods.update(p.moods)

        # Get preferred genres based on moods
        preferred_genres = set()
        for mood in all_moods:
            genres = self.MOOD_GENRE_PREFERENCES.get(mood.lower(), [])
            preferred_genres.update(genres)

        # Sort movies: preferred genres first, then by rating
        def movie_sort_key(m):
            has_preferred = any(g in preferred_genres for g in m.get('genres', []))
            rating = m.get('vote_average', 0) or 0
            return (not has_preferred, -rating)  # False < True, so preferred comes first

        sorted_movies = sorted(movies_with_trailers, key=movie_sort_key)

        movie_list = "\n".join([
            f"- ID:{m['id']} | {m['title']} | {', '.join(m['genres'])} | Rating:{m['vote_average']}"
            for m in sorted_movies[:30]  # First 30 movies with trailers
        ])

        # Build mood definitions for the prompt
        mood_explanations = []
        for mood in all_moods:
            definition = self.MOOD_DEFINITIONS.get(mood.lower())
            if definition:
                mood_explanations.append(f'"{mood}" = {definition}')

        prompt = f"""You are a movie recommendation expert.
        A group wants to watch a movie together.

        MOOD DEFINITIONS (interpret these correctly):
        {chr(10).join(mood_explanations)}

        Participants:
        """
        for participant in participants:
            prompt += f"- {participant.name}: wants {', '.join(participant.moods)} movies"
            if participant.note:
                prompt += f". Note: \"{participant.note}\""
            prompt += "\n"

        # Add swipe history context for round 2+
        if round_num > 1 and swipe_history:
            prompt += "\n        Previous swipe history (use this to improve recommendations):\n"
            for user_name, history in swipe_history.items():
                likes = history.get("likes", [])
                dislikes = history.get("dislikes", [])
                if likes or dislikes:
                    prompt += f"        {user_name}:\n"
                    if likes:
                        prompt += f"          Liked: {', '.join(likes[:5])}\n"
                    if dislikes:
                        prompt += f"          Disliked: {', '.join(dislikes[:5])}\n"

            prompt += """
        IMPORTANT: Based on the swipe history above:
        - Recommend movies SIMILAR to liked ones
        - AVOID movies similar to disliked ones
        - The group has already seen some movies, so suggest fresh picks
        """

        prompt += f"""
        Available movies (ONLY choose from this list):
        {movie_list}

        CRITICAL RULES:
        1. If "funny" is requested, prioritize COMEDY genre movies
        2. If "dark" is requested, DO NOT default to Horror - prefer psychological dramas, noir, crime
        3. The "why" field MUST accurately describe the movie's actual genre and tone
        4. DO NOT say "romance" for war films or "comedy" for dramas

        Recommend {num_recommendations} movies that would satisfy everyone.
        Return ONLY valid JSON array with movie IDs: [{{"id": 12345, "title": "Movie Name", "why": "Reason"}}]
        IMPORTANT: You MUST include the exact ID from the list above for each movie.

        """
        return prompt
    def _find_movie_by_id(self, movie_id: int) -> dict | None:
        """Find a movie in the database by ID"""
        for movie in self.movies:
            if movie['id'] == movie_id:
                return movie
        return None

    def _find_movie_by_title(self, title: str) -> dict | None:
        """Find a movie in the database by title (fuzzy match)"""
        title_lower = title.lower().strip()
        # Exact match first
        for movie in self.movies:
            if movie['title'].lower().strip() == title_lower:
                return movie
        # Partial match fallback
        for movie in self.movies:
            if title_lower in movie['title'].lower() or movie['title'].lower() in title_lower:
                return movie
        return None

    def _parse_response(self, response_content: str) -> list[MovieRecommendation]:
        try:
            # JSON'u bul (bazen AI ekstra text ekler)
            start = response_content.find('[')
            end = response_content.rfind(']') + 1
            if start == -1 or end == 0:
                return []
            json_str = response_content[start:end]
            data = json.loads(json_str)

            recommendations = []
            for item in data:
                movie_id = item.get("id", 0)
                title = item.get('title', '')
                why = item.get('why', '')

                # Önce ID ile bul
                movie_data = self._find_movie_by_id(movie_id)

                # ID bulunamazsa title ile ara
                if not movie_data and title:
                    movie_data = self._find_movie_by_title(title)

                if movie_data:
                    recommendation = MovieRecommendation(
                        id=movie_data['id'],
                        title=movie_data['title'],
                        why=why,
                        poster_url=movie_data.get('poster_url'),
                        overview=movie_data.get('overview'),
                        vote_average=movie_data.get('vote_average'),
                        release_year=movie_data.get('release_year'),
                        genres=movie_data.get('genres', []),
                        trailer_key=movie_data.get('trailer_key')
                    )
                else:
                    # Fallback if movie not found
                    recommendation = MovieRecommendation(
                        id=0,
                        title=title,
                        why=why,
                        genres=[]
                    )
                recommendations.append(recommendation)
            return recommendations
        except json.JSONDecodeError:
            return []
    
