"""
Startup script: Seeds ChromaDB from movies.json if empty.
Called before uvicorn starts in production.
"""
import json
from ml.embeddings import EmbeddingEngine


def seed_if_empty():
    """Seed ChromaDB with movie embeddings if collection is empty."""
    engine = EmbeddingEngine()
    count = engine.vector_store.get_count()

    if count > 0:
        print(f"ChromaDB already has {count} movies, skipping seed.")
        return

    print("ChromaDB is empty, seeding from data/movies.json...")
    with open("data/movies.json", "r", encoding="utf-8") as f:
        movies = json.load(f)

    print(f"Loaded {len(movies)} movies, generating embeddings...")
    engine.embed_all_movies(movies)
    print(f"Seeding complete! {engine.vector_store.get_count()} movies in ChromaDB.")


if __name__ == "__main__":
    seed_if_empty()
