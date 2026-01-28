# CineMatch

A group movie recommendation system with semantic search, fairness-aware ranking, and online learning.

## Overview

CineMatch helps groups of people find movies everyone will enjoy. It uses semantic embeddings to understand user preferences, applies fairness algorithms to balance conflicting tastes, and learns from swipe feedback to improve recommendations over time.

**Live Demo:** https://cine-match-omega.vercel.app

## Features

- **Semantic Search** - Natural language mood queries mapped to movie embeddings using sentence-transformers
- **Group Fairness** - Least Misery algorithm ensures no one is completely unhappy with recommendations
- **Swipe Feedback** - Tinder-style interface that learns from user preferences
- **Match Detection** - Identifies movies the whole group agreed on (perfect matches and majority matches)
- **LLM Ranking** - Final recommendations refined by Groq LLM for personalized explanations

## Architecture

```
Frontend (Next.js)                    Backend (FastAPI)
     |                                      |
     |  /recommendations                    |
     |------------------------------------->|
     |                                      |
     |     1. Semantic search (ChromaDB)    |
     |     2. Per-user embedding queries    |
     |     3. Fairness-aware merging        |
     |     4. LLM final ranking (Groq)      |
     |                                      |
     |<-------------------------------------|
     |      Ranked movies with explanations |
```

## Tech Stack

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Framer Motion (animations)

**Backend**
- FastAPI
- ChromaDB (vector database)
- sentence-transformers (all-MiniLM-L6-v2)
- Groq API (LLaMA 3.1 70B)
- NumPy

**Infrastructure**
- Vercel (frontend hosting)
- HuggingFace Spaces (backend hosting)
- GitHub Actions (CI/CD)

## Project Structure

```
CineMatch/
├── web/                          # Next.js frontend
│   ├── app/                      # App router pages
│   ├── components/               # React components
│   ├── lib/                      # Utilities and API client
│   └── store/                    # Zustand stores
│
├── api-python/                   # FastAPI backend
│   ├── ai/                       # Model gateway and LLM clients
│   │   ├── gateway.py            # Main recommendation orchestrator
│   │   ├── groq_client.py        # Groq LLM integration
│   │   └── types.py              # Pydantic models
│   ├── ml/                       # Machine learning components
│   │   ├── embeddings.py         # Embedding engine
│   │   ├── group_fairness.py     # Fairness-aware recommender
│   │   ├── feedback_learner.py   # Online learning from swipes
│   │   └── evaluation.py         # Evaluation pipeline
│   ├── db/                       # Vector store
│   ├── data/                     # Movie dataset (1000 films)
│   └── main.py                   # FastAPI application
│
└── .github/workflows/            # CI/CD configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Groq API key (free tier available)

### Backend Setup

```bash
cd api-python

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Start server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd web

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL=http://localhost:8000

# Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recommendations` | Get movie recommendations for a group |
| POST | `/swipe` | Record a swipe action (like/dislike/skip) |
| GET | `/session/{id}/stats` | Get swipe statistics for a session |
| GET | `/session/{id}/matches` | Calculate group matches |
| DELETE | `/session/{id}` | Clear session data |
| GET | `/evaluate` | Run evaluation pipeline |
| GET | `/health` | Health check |

### Request Example

```bash
curl -X POST http://localhost:8000/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "participants": [
      {"name": "Alice", "moods": ["funny", "relaxed"], "note": "no horror"},
      {"name": "Bob", "moods": ["intense", "thrilling"]}
    ],
    "num_recommendations": 5
  }'
```

## Evaluation Metrics

The system includes an evaluation pipeline measuring four key metrics:

| Metric | Description | Target |
|--------|-------------|--------|
| Consistency | Same input produces same output | >80% |
| Genre Alignment | Mood selections match recommended genres | >60% |
| Diversity | Variety of genres in recommendations | 4+ unique |
| Fairness | Minimum satisfaction across group members | avg_min > 0.4 |

Run evaluation:
```bash
cd api-python
python -m scripts.run_evaluation
```

## Algorithm Details

### Fairness-Aware Ranking

The system uses a weighted combination of average and minimum scores:

```
fair_score = (1 - w) * average_score + w * minimum_score
```

Where `w = 0.5` balances group consensus with individual satisfaction.

### Online Learning

Swipe feedback is incorporated through embedding refinement:
1. Liked movies pull the user's preference vector closer
2. Disliked movies push the preference vector away
3. Updated preferences influence subsequent recommendations

## Deployment

### Frontend (Vercel)

1. Connect GitHub repository to Vercel
2. Set environment variable: `NEXT_PUBLIC_API_URL`
3. Deploy

### Backend (HuggingFace Spaces)

1. Create a new Docker Space
2. Copy contents of `api-python/` to Space repository
3. Rename `HF_README.md` to `README.md`
4. Set secrets: `GROQ_API_KEY`, `TMDB_API_KEY`
5. Deploy

## CI/CD

GitHub Actions runs on every push:
- Frontend: Lint and build verification
- Backend: Quick evaluation test

## License

MIT

## Acknowledgments

- Movie data sourced from TMDB API
- Embedding model: sentence-transformers/all-MiniLM-L6-v2
- LLM: Groq (LLaMA 3.1 70B)
