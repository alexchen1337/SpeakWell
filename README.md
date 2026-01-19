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


# Demo

https://github.com/user-attachments/assets/c8abbb61-b754-4d6b-9037-38672448e831


# Project Setup

## Backend Setup

``` bash
cd backend
python -m venv venv

# Mac / Linux
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1

pip install -r requirements.txt
python main.py
```

## Frontend Setup

``` bash
cd frontend
npm install
npm run dev
```

## Notes

-   Make sure Python 3.9+ and Node.js 18+ are installed.
-   Activate the virtual environment before running backend commands.
-   If ports conflict, update them in the config files.
-   Make sure you have the correct .env setup
