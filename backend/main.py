import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import sessions, upload, agent, escalations, records, mock_api

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("migration")

Base.metadata.create_all(bind=engine)
logger.info("Database tables initialized")

app = FastAPI(
    title="Data Migration Agent",
    version="1.0.0",
    description="AI-powered HR data migration with human-in-the-loop review",
)

# Allow configurable CORS origins
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(sessions.router)
app.include_router(upload.router)
app.include_router(agent.router)
app.include_router(escalations.router)
app.include_router(records.router)
app.include_router(mock_api.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
