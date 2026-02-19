from pathlib import Path
import os
from dotenv import load_dotenv

ROOT_ENV = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=ROOT_ENV)

FRONTEND_URL = os.getenv("FRONTEND_URL")
BACKEND_URL = os.getenv("BACKEND_URL")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "audio-files")
SIGNED_URL_EXPIRES_IN = int(os.getenv("SIGNED_URL_EXPIRES_IN", "7200"))

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

IS_DEVELOPMENT = FRONTEND_URL and ("localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL)
