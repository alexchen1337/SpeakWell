from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
from auth import router as auth_router, get_current_user
from audio import router as audio_router
from transcription import router as transcription_router
from rubrics import router as rubrics_router
from grading import router as grading_router
from database import init_db, User

# Import security middleware
from security import (
    CSRFProtectionMiddleware,
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    get_csrf_token
)

app = FastAPI(
    title="SpeakWell Audio API",
    description="AI-powered presentation grading system with comprehensive security",
    version="2.0.0"
)

# Add security middleware (order matters!)
# 1. Security headers (outermost)
app.add_middleware(SecurityHeadersMiddleware)

# 2. Rate limiting
app.add_middleware(RateLimitMiddleware)

# 3. CSRF protection
app.add_middleware(CSRFProtectionMiddleware)

# 4. CORS (innermost, closest to routes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token"],  # Expose CSRF token header to frontend
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth_router)
app.include_router(audio_router)
app.include_router(transcription_router)
app.include_router(rubrics_router)
app.include_router(grading_router)


@app.on_event("startup")
async def startup_event():
    init_db()
    print("SpeakWell API started with security features enabled")
    print("- CSRF Protection: ✓")
    print("- Rate Limiting: ✓")
    print("- Security Headers: ✓")
    print("- Secure File Upload: ✓")


@app.get("/")
async def root():
    return {
        "message": "SpeakWell Audio API",
        "status": "running",
        "version": "2.0.0",
        "security_features": [
            "CSRF Protection",
            "Rate Limiting",
            "Security Headers",
            "Secure File Upload Validation",
            "Path Traversal Protection"
        ]
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/csrf-token")
async def get_csrf_token_endpoint(current_user: User = Depends(get_current_user)):
    """Get a CSRF token for authenticated users"""
    token = get_csrf_token()
    return {"csrf_token": token}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
