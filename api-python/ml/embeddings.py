from sentence_transformers import SentenceTransformer
from db.vector_store import  MovieVectorStore

class EmbeddingEngine:
    def __init__(self):
        # Model yükle (ilk seferde indirir ~90MB)
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.movie_embeddings= {} #movie_id: embedding vector
        self.vector_store = MovieVectorStore()
    
    def embed_movie(self, movie: dict):
        # make one big text from movie details
        text = f"{movie['title']} | {movie['overview']} | Genres: {movie['genres']} | vote_average : {movie['vote_average']}"
        # turn into vector embedding
        return self.model.encode(text)
    
    def _create_film_text(self, movie: dict) -> str:
        """Film bilgilerini tek string'e çevir"""
        title = movie.get("title", "")
        overview = movie.get("overview", "")
        genres = ", ".join(movie.get("genres", []))
                      
        return f"{title}. {genres}. {overview}"
    
    def embed_all_movies(self,movies: list[dict]) -> None:
        #Remove duplicates by ID
        seen_ids = set()
        unique_movies= []

        for movie in movies:
            if movie["id"] not in seen_ids:
                unique_movies.append(movie)
                seen_ids.add(movie["id"])
            
        print(f"Removed {len(movies) - len(unique_movies)} duplicates")

        #Embed all movies and register to chromadb
        # Film text'lerini hazırla
        texts = [self._create_film_text(m) for m in unique_movies]
       #create embeddings for all moviess
        embeddings = self.model.encode(texts, show_progress_bar=True)
        # Store embeddings in vector store
      
        self.vector_store.add_movie_embedding(unique_movies, embeddings.tolist()) 
        print(f"Done! {self.vector_store.get_count()} movies in vector store")
    
    def embed_query (self,query:str) -> list[float]:
        """ Embed user pereference query/ mood into vector"""
        return self.model.encode([query])[0].tolist()
    def search_similar_movies(self, query: str, top_k: int=5) -> list[dict]:
        """ Search similar movies from vector store based on user query"""
        query_embedding= self.embed_query(query)
        results= self.vector_store.query_similar_movies(query_embedding, top_k)
        return results
    