from fastapi import FastAPI 
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
load_dotenv()

from ai.types import ParticipantPreference,GatewayResponse
from ai.gateway import ModelGateway

app= FastAPI(title='Cinematch Movie Recommendation API')

# CORS - Next.js'in bağlanabilmesi için
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

#Start model gateway
gateway= ModelGateway()

class RecommendationRequest(BaseModel):
    participants: list[ParticipantPreference]
    num_recommendations: int =5

@app.post("/recommendations",response_model= GatewayResponse)
async def get_recommendations(request: RecommendationRequest):
    """Get movie recommendations for the group"""
    return gateway.recommend(request.participants,request.num_recommendations)

@app.get("/health")
async def health_check():
    return {"status":"ok"}
