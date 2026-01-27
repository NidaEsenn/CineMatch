import os
import httpx
from typing import Optional
import time
class TMDBClient:
    """TMDB API client with rate limiting"""

    def __init__(self):
        self.api_key = os.getenv("TMDB_API_KEY")
        self.base_url ="https://api.themoviedb.org/3"
        self.image_base_url ="https://image.tmdb.org/t/p/w500"
        self.last_request_time=0
        self.min_interval=0.25 # 4 requests per second
        self.genre_map = self._fetch_genres()

    def _fetch_genres(self)->dict:
        """ Fetch genre mapping from TMDB"""
        url = f"{self.base_url}/genre/movie/list"
        params={
            "api_key":self.api_key,
            "language":"en-US"
        }
        self._wait_for_rate_limit()
        response= httpx.get(url,params=params)
        response.raise_for_status()
        data=response.json()
        return {genre["id"]:genre["name"] for genre in data.get("genres",[])}
    

    def _wait_for_rate_limit(self):
        """ensure we respect rate limits"""
        elapsed= time.time()- self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval- elapsed)
        self.last_request_time= time.time()

    def get_popular_movies(self, page:int=1) -> list[dict]:
        """Fetch popular movies from TMDB"""
        url = f"{self.base_url}/movie/popular"
        params= {
            "api_key": self.api_key,
            "language":"en-US",
            "page":page
        }
        self._wait_for_rate_limit()
        response= httpx.get(url,params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("results",[])
    
    def get_movie_details(self,movie_id:int) -> Optional[dict]:
        """fetch detailed info for a specific movie"""
        url= f"{self.base_url}/movie/{movie_id}"
        params={
            "api_key":self.api_key,
            "language":"en-US"
        }
        self._wait_for_rate_limit()
        response = httpx.get(url,params=params)
        if response.status_code ==404:
            return None
        response.raise_for_status()
        return response.json()

    def get_movie_trailer(self, movie_id: int) -> Optional[str]:
        """Fetch YouTube trailer key for a movie, trying multiple languages"""
        # Try different languages to find trailer
        languages = ["en-US", "es-ES", "es-MX", "de-DE", "fr-FR", "ko-KR", "ja-JP", ""]

        all_videos = []
        for lang in languages:
            url = f"{self.base_url}/movie/{movie_id}/videos"
            params = {"api_key": self.api_key}
            if lang:
                params["language"] = lang

            self._wait_for_rate_limit()
            response = httpx.get(url, params=params)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            data = response.json()
            all_videos.extend(data.get("results", []))

            # If we found videos, no need to try more languages
            if all_videos:
                break

        # Remove duplicates by video key
        seen_keys = set()
        unique_videos = []
        for video in all_videos:
            key = video.get("key")
            if key and key not in seen_keys:
                seen_keys.add(key)
                unique_videos.append(video)

        # Find YouTube trailer (prefer "Trailer" type, then "Teaser")
        for video in unique_videos:
            if video.get("site") == "YouTube" and video.get("type") == "Trailer":
                return video.get("key")
        # Fallback to teaser
        for video in unique_videos:
            if video.get("site") == "YouTube" and video.get("type") == "Teaser":
                return video.get("key")
        # Fallback to any YouTube video
        for video in unique_videos:
            if video.get("site") == "YouTube":
                return video.get("key")
        return None
    
    def transform_movie(self,raw_movie: dict) ->dict:
        """transform tmdb response to our schema"""
        #if genres_ids is present, we need to fetch genre names separetely
        #if genres is present, we can use it directly
        if "genres" in raw_movie:
            genres = [genre["name"] for genre in raw_movie["genres"]]

        else:
            genre_ids=raw_movie.get("genre_ids",[])
            genres=[self.genre_map.get(gid,"unknown") for gid in genre_ids]

        return {
            "id": raw_movie.get("id"),
            "title": raw_movie.get("title"),
            "poster_url": f"{self.image_base_url}{raw_movie.get('poster_path')}" if raw_movie.get("poster_path") else None,
            "overview":raw_movie.get("overview"),
            "vote_average":raw_movie.get("vote_average"),
            "release_year": raw_movie.get("release_date", "")[:4] if raw_movie.get("release_date") else None,
            "genres":genres,
            "runtime": raw_movie.get("runtime")
                                     
        }
