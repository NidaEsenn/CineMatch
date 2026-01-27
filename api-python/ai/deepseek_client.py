import os
from openai import OpenAI
from .types import ParticipantPreference, MovieRecommendation
import json
class DeepseekClient:

    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.client= OpenAI(api_key=self.api_key, base_url="https://api.deepseek.com")
        self.movies = self._load_movies()

    def _load_movies(self) -> list[dict]:
        """ load movie dataset from a local JSON file"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        movies_path = os.path.join(current_dir,"..","data","movies.json")
        with open(movies_path,"r",encoding="utf-8") as f:
            return json.load(f)
        
    def recommend_movies(self,participants: list[ParticipantPreference],num_recommendations: int =5) -> list[MovieRecommendation]:
        #prepare the prompt for deepseek model
        prompt= self._build_prompt(participants,num_recommendations)
        response= self.client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role":"user","content":prompt}],
            max_tokens=1000,
            temperature=0.7)
        content= response.choices[0].message.content
        if content is None:
            return []
        recommendations= self._parse_response(content)
        return recommendations
        
        

    def _build_prompt(self, participants: list[ParticipantPreference], num_recommendations: int) -> str:
        # Only include movies that have trailers
        movies_with_trailers = [m for m in self.movies if m.get('trailer_key')]
        movie_list = "\n".join([
        f"- ID:{m['id']} | {m['title']} | {', '.join(m['genres'])} | Rating:{m['vote_average']}"
        for m in movies_with_trailers[:50]
    ])
    
        prompt = f"""You are a movie recommendation expert.
        A group wants to watch a movie together.

        Participants:
        """        
        
        for participant in participants:
            prompt += f"-{participant.name}: wants {', '.join(participant.moods)} movies"
            if participant.note:
                prompt += f". Note:\" {participant.note}\""
            prompt+="\n"
        prompt += f"""
        Available movies (ONLY choose from this list):
        {movie_list}
        Recommend {num_recommendations} movies that would satisfy everyone.
        Return ONLY valid JSON array: [{{"title": "Movie Name", "why": "Reason"}}]
        """
        return prompt
    
    def _find_movie_by_title(self, title: str) -> dict | None:
        """Find a movie in the database by title (fuzzy match)"""
        title_lower = title.lower().strip()
        for movie in self.movies:
            if movie['title'].lower().strip() == title_lower:
                return movie
        # Fuzzy match - partial match
        for movie in self.movies:
            if title_lower in movie['title'].lower() or movie['title'].lower() in title_lower:
                return movie
        return None

    def _parse_response(self, response_content: str) -> list[MovieRecommendation]:
        try:
            start = response_content.find('[')
            end = response_content.rfind(']') + 1
            if start == -1 or end == 0:
                return []
            json_str = response_content[start:end]
            data = json.loads(json_str)

            recommendations = []
            for item in data:
                title = item.get('title', '')
                why = item.get('why', '')

                # Find full movie data from movies.json
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
    