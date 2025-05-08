from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import shutil
from recruiter_agent.graph import run_recruiting_assistant, extract_text_from_file
from models.run_history import AgentRun, AgentRunInput, AgentRunOutput
from config import settings
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(database=client[settings.MONGODB_DB], document_models=[AgentRun])
    yield

app = FastAPI(title="Recruiter Agent API", version="1.0.0", lifespan=lifespan)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

from api.agent import router as agent_router
app.include_router(agent_router)

# For local development only
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)