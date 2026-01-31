"""CSRF Protection Middleware for FastAPI

Provides token-based CSRF protection for all state-changing operations.
"""
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import Headers
import secrets
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Optional
import os

# CSRF token configuration
CSRF_TOKEN_LENGTH = 32
CSRF_TOKEN_EXPIRY = timedelta(hours=24)
CSRF_SECRET_KEY = os.getenv("CSRF_SECRET_KEY", secrets.token_hex(32))

# Methods that require CSRF protection
STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Exempt paths (e.g., authentication endpoints)
EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/health",
    "/"
}


class CSRFToken:
    """Generate and validate CSRF tokens"""
    
    @staticmethod
    def generate() -> str:
        """Generate a new CSRF token"""
        token = secrets.token_urlsafe(CSRF_TOKEN_LENGTH)
        timestamp = int(datetime.utcnow().timestamp())
        
        # Create signature: HMAC(secret, token + timestamp)
        message = f"{token}:{timestamp}".encode()
        signature = hmac.new(
            CSRF_SECRET_KEY.encode(),
            message,
            hashlib.sha256
        ).hexdigest()
        
        return f"{token}:{timestamp}:{signature}"
    
    @staticmethod
    def validate(token: str) -> bool:
        """Validate a CSRF token"""
        if not token:
            return False
        
        try:
            parts = token.split(":")
            if len(parts) != 3:
                return False
            
            token_value, timestamp_str, signature = parts
            timestamp = int(timestamp_str)
            
            # Check if token has expired
            token_time = datetime.fromtimestamp(timestamp)
            if datetime.utcnow() - token_time > CSRF_TOKEN_EXPIRY:
                return False
            
            # Verify signature
            message = f"{token_value}:{timestamp_str}".encode()
            expected_signature = hmac.new(
                CSRF_SECRET_KEY.encode(),
                message,
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
        
        except (ValueError, IndexError):
            return False


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce CSRF protection on state-changing requests"""
    
    async def dispatch(self, request: Request, call_next):
        # Skip CSRF check for safe methods
        if request.method not in STATE_CHANGING_METHODS:
            return await call_next(request)
        
        # Skip CSRF check for exempt paths
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)
        
        # Extract CSRF token from headers
        csrf_token = request.headers.get("X-CSRF-Token")
        
        if not csrf_token:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF token missing"}
            )
        
        # Validate CSRF token
        if not CSRFToken.validate(csrf_token):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Invalid or expired CSRF token"}
            )
        
        # CSRF token is valid, proceed with request
        response = await call_next(request)
        return response


def get_csrf_token() -> str:
    """Generate a new CSRF token for the client"""
    return CSRFToken.generate()
