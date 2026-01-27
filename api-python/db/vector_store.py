import chromadb
from typing import Any


class MovieVectorStore:
    """ChromaDB wrapper for storing movie embeddings

    ChromaDB sadece arama indeksi olarak kullanılır.
    Tam film verileri (poster, trailer vs.) JSON'dan alınır.
    """

    def __init__(self, db_path: str = "db/chroma"):
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(
            name="movies",
            metadata={"hnsw:space": "cosine"}
        )

    def add_movie_embedding(self, movies: list[dict], embeddings: list[list[float]]) -> None:
        """Add movies with their embeddings to the collection

        Args:
            movies: List of movie dicts (id, title, overview, genres)
            embeddings: List of embedding vectors (384-dim each)
        """
        ids = [str(m["id"]) for m in movies]

        # Sadece arama için gereken minimum metadata
        metadatas = []
        for m in movies:
            metadatas.append({
                "title": m.get("title") or "",
                "genres": ",".join(m.get("genres") or []),
            })

        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas
        )
        print(f"Added {len(movies)} movies to vector store")

    def query_similar_movies(self, embedding: list[float], n_results: int = 20) -> list[dict]:
        """Find movies similar to the query embedding

        Args:
            embedding: 384-dim query embedding vector
            n_results: number of results to return

        Returns:
            List of dicts with id, title, genres, similarity score
        """
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=n_results,
            include=["metadatas", "distances"]
        )

        similar_movies = []
        for i, movie_id in enumerate(results['ids'][0]):
            metadata = results["metadatas"][0][i]
            distance = results["distances"][0][i]

            similar_movies.append({
                "id": int(movie_id),
                "title": metadata["title"],
                "genres": metadata["genres"].split(",") if metadata["genres"] else [],
                "similarity": 1 - distance,
            })
        return similar_movies

    def delete_all_movies(self) -> None:
        """Delete all movies from the collection"""
        self.client.delete_collection("movies")
        self.collection = self.client.get_or_create_collection(
            name="movies",
            metadata={"hnsw:space": "cosine"}
        )
        print("Deleted all movies from vector store")

    def get_count(self) -> int:
        """Get the number of movies in the collection"""
        return self.collection.count()

    def movie_exists(self, movie_id: int) -> bool:
        """Check if a movie exists in the collection"""
        result = self.collection.get(ids=[str(movie_id)])
        return len(result["ids"]) > 0