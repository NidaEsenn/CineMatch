import json

class MovieRepository():
    """It reads movie from a JSON file and provides access methods by ID """

    def __init__(self,json_path: str):
        self.json_path=json_path
        self.movies_list= self. _load_movies()
        self.movies ={}
        for movie in self.movies_list:
            self.movies[movie["id"]] = movie


    def _load_movies(self):
        """Load movies from the JSON file."""
        try:
            with open(self.json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return []

    def get_movie_by_id(self, movie_id: int):
        """Return a movie by its ID."""
        return self.movies.get(movie_id)
    def get_movies_by_ids(self, movie_ids: list[int]):
        """Return a list of movies by their IDs."""
        results=[]
        for id in movie_ids:
            movie= self.get_movie_by_id(id)
            if movie:
                results.append(movie)

        return results
    