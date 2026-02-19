from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

from app.core.config import FRONTEND_URL
from app.models import Base, engine
from app.services.rubric_service import seed_abet_rubric
from app.api.auth import router as auth_router
from app.api.audio import router as audio_router
from app.api.transcription import router as transcription_router
from app.api.rubrics import router as rubrics_router
from app.api.grading import router as grading_router
from app.api.classes import router as classes_router

app = FastAPI(title="Speakwell Audio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth_router)
app.include_router(audio_router)
app.include_router(transcription_router)
app.include_router(rubrics_router)
app.include_router(grading_router)
app.include_router(classes_router)


@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    seed_abet_rubric()


@app.get("/")
async def root():
    return {"message": "Speakwell Audio API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def dev():
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    dev()
