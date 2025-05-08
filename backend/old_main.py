from signal import signal, SIGINT, SIGTERM
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import app  # Import the FastAPI app from app.py
from contextlib import asynccontextmanager
import uvicorn
# from services.recruiter_agent import AgentService
from config import settings
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models.run_history import AgentRun


@asynccontextmanager
async def lifespan(app: FastAPI):
    # app.state.recruiter_agent = AgentService()

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    # Initialize Beanie ODM with AgentRun document
    await init_beanie(database=client[settings.MONGODB_DB], document_models=[AgentRun])

    print("FastAPI app initialized")

    try:
        # await app.state.agent_service.initialize()
        yield
    except Exception as e:
        print(f"Error during app startup: {e}")
    finally:
        print("Shutting down services...")
        # await app.state.agent_service.shutdown()
        print("Shutdown complete")

# Add CORS middleware to the imported app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ai.sleebit.com", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


def handle_shutdown_signal(signal, frame):
    print("Shutdown signal received. Cleaning up...")
    # Perform cleanup actions here
    sys.exit(0)


signal(SIGINT, handle_shutdown_signal)
signal(SIGTERM, handle_shutdown_signal)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)