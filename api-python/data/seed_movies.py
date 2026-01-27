import json
from dotenv import load_dotenv
from tmdb_client import TMDBClient
load_dotenv()
"""Script to seed movies data from TMDB into a JSON file"""

def seed_movies(num_pages: int =50, include_trailers: bool = True):
    """Fetch popular movies from TMDB and save to movies.json
    Args:
        num_pages(int): Number of pages to fetch (20 movies per page)
        include_trailers(bool): Whether to fetch trailer keys (slower but complete)"""
    tmdb_client= TMDBClient()
    all_movies= []
    seen_ids = set()
    for page in range(1,num_pages+1):
        print(f" Page {page}/{num_pages}...")
        raw_movies= tmdb_client.get_popular_movies(page=page)
                  
        for i, raw_movie in enumerate(raw_movies):
            if raw_movie["id"] in seen_ids:
                continue
            seen_ids.add(raw_movie["id"])
            movie= tmdb_client.transform_movie(raw_movie)

            # Fetch trailer if enabled
            if include_trailers:
                movie_id = raw_movie.get("id")
                if movie_id:
                    trailer_key = tmdb_client.get_movie_trailer(movie_id)
                    movie["trailer_key"] = trailer_key
                    print(f"   [{(page-1)*20 + i + 1}] {movie['title']} - trailer: {'✓' if trailer_key else '✗'}")

            all_movies.append(movie)

    #save to movies.json
    output_path= "movies.json"
    with open (output_path,"w",encoding="utf-8") as f:
        json.dump(all_movies,f,indent=2,ensure_ascii=False)

    movies_with_trailers = sum(1 for m in all_movies if m.get("trailer_key"))
    print(f"\nSaved {len(all_movies)} movies to {output_path}")
    print(f"Movies with trailers: {movies_with_trailers}/{len(all_movies)}")

if __name__ == "__main__":
    seed_movies(num_pages=50) #100 movies 

    
