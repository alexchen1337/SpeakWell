## Demo

https://github.com/user-attachments/assets/1ca49d90-6c28-4b67-b803-c0583006c938

HD: https://youtu.be/hIJg_Xyjhro

## What This Project Does

This project automatically grades student presentations using AI, based on
**ABET-aligned rubrics** or fully **custom evaluation criteria**.

Users upload **audio or video presentations**, which are then:
- Transcribed using OpenAI's state-of-the-art speech-to-text models
- Evaluated by large language models against structured rubrics
- Scored with clear, criterion-level feedback

The system is built with a modern full-stack architecture:
- **Next.js** for the frontend
- **FastAPI** for the backend API
- **Supabase with PostgreSQL** for authentication, storage, and database management

It is designed for **educators, teaching assistants, and academic evaluators**
who need consistent, scalable, and explainable presentation grading.

# Project Setup

## Prerequisites

- Python 3.11+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- [pnpm](https://pnpm.io/installation) (Node package manager)

## Environment Variables

Create a `.env` file at the **repo root** (one level above `backend/` and `frontend/`):

```env
# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Auth
JWT_SECRET=your-secret-key-here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=audio-files

# OpenAI
OPENAI_API_KEY=sk-...

# Optional
SIGNED_URL_EXPIRES_IN=7200
```

---

## Running with Docker (recommended)

Requires [OrbStack](https://orbstack.dev) or Docker Desktop.

```bash
docker-compose up --build
```

The API will be available at `http://localhost:8000`.

To stop:
```bash
docker-compose down
```

---

## Running Locally (without Docker)

### Backend

```bash
cd backend

# Install dependencies
uv sync

# Run the development server
uv run dev
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

---

## Project Structure

```
SpeakWell/
├── frontend/        # Next.js app
├── backend/         # FastAPI app
│   ├── app/
│   │   ├── api/          # Thin route handlers — just call services
│   │   │   ├── auth.py
│   │   │   ├── audio.py
│   │   │   ├── transcription.py
│   │   │   ├── grading.py
│   │   │   ├── rubrics.py
│   │   │   └── classes.py
│   │   ├── core/
│   │   │   ├── config.py       # Settings loaded from .env
│   │   │   ├── security.py     # JWT creation/decoding, cookie helpers
│   │   │   └── dependencies.py # FastAPI deps: get_db, get_current_user
│   │   ├── dao/          # All database queries — one DAO per model
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   └── services/     # Business logic
│   ├── tests/
│   │   ├── conftest.py   # Fixtures: in-memory DB, TestClient, auth helpers
│   │   ├── api/          # Integration tests per route module
│   │   ├── dao/          # Unit tests per DAO
│   │   └── services/     # Unit tests for business logic
│   └── pyproject.toml
├── docker-compose.yml
└── .env
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Create account via Supabase |
| POST | `/auth/login` | Login, returns JWT cookies |
| POST | `/auth/logout` | Clear auth cookies |
| GET | `/auth/me` | Current user info |
| PATCH | `/auth/me/name` | Update display name |
| PATCH | `/auth/me/role` | Set role (student/instructor) |
| GET | `/api/audio` | List user's audio files |
| POST | `/api/audio/upload` | Upload audio/video file |
| GET | `/api/audio/:id` | Get audio file details |
| DELETE | `/api/audio/:id` | Delete audio file |
| GET | `/api/transcripts/:audioId` | Get transcript for audio |
| POST | `/api/transcripts/:audioId/retry` | Retry failed transcription |
| GET | `/api/rubrics` | List accessible rubrics |
| POST | `/api/rubrics` | Create custom rubric |
| GET | `/api/rubrics/:id` | Get rubric details |
| DELETE | `/api/rubrics/:id` | Delete custom rubric |
| POST | `/api/transcripts/:id/gradings` | Grade a transcript |
| GET | `/api/transcripts/:id/gradings` | List gradings for transcript |
| GET | `/api/gradings` | List all gradings (filterable) |
| GET | `/api/gradings/:id` | Get grading result |
| DELETE | `/api/gradings/:id` | Delete grading |
| POST | `/api/classes` | Create classroom (instructor only) |
| POST | `/api/classes/join` | Join class by code (student) |
| GET | `/api/classes/teaching` | List classes you teach |
| GET | `/api/classes/enrolled` | List classes you're enrolled in |
| GET | `/api/classes/:id` | Get class details |
| DELETE | `/api/classes/:id` | Delete class (instructor only) |
| GET | `/api/classes/:id/students` | List enrolled students |
| GET | `/api/classes/:id/presentations` | List student submissions |
| GET | `/api/classes/:id/gradings` | List all gradings in class |
| GET | `/api/classes/:id/stats` | Class statistics |
| DELETE | `/api/classes/:id/leave` | Leave a class (student) |
