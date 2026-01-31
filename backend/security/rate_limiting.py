"""Rate Limiting for API Endpoints

Protects API endpoints from abuse and helps manage OpenAI API costs.
"""
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, Tuple
import asyncio
import time


class RateLimitConfig:
    """Rate limit configuration for different endpoint types"""
    
    # General API endpoints: 100 requests per minute
    GENERAL_LIMIT = 100
    GENERAL_WINDOW = 60  # seconds
    
    # OpenAI API endpoints (transcription, grading): 10 requests per minute
    OPENAI_LIMIT = 10
    OPENAI_WINDOW = 60  # seconds
    
    # File upload: 20 uploads per minute
    UPLOAD_LIMIT = 20
    UPLOAD_WINDOW = 60  # seconds
    
    # Authentication: 10 attempts per minute
    AUTH_LIMIT = 10
    AUTH_WINDOW = 60  # seconds


class RateLimiter:
    """Token bucket rate limiter implementation"""
    
    def __init__(self):
        # Store: {(client_id, endpoint_category): (tokens, last_update)}
        self.buckets: Dict[Tuple[str, str], Tuple[float, float]] = {}
        self.lock = asyncio.Lock()
    
    async def is_allowed(
        self,
        client_id: str,
        endpoint_category: str,
        max_tokens: int,
        refill_rate: float  # tokens per second
    ) -> Tuple[bool, int]:
        """Check if request is allowed under rate limit
        
        Args:
            client_id: Unique identifier for client (IP or user ID)
            endpoint_category: Category of endpoint (general, openai, upload, auth)
            max_tokens: Maximum tokens in bucket
            refill_rate: Rate at which tokens refill (per second)
            
        Returns:
            Tuple of (is_allowed, retry_after_seconds)
        """
        async with self.lock:
            now = time.time()
            key = (client_id, endpoint_category)
            
            if key not in self.buckets:
                # Initialize bucket with full tokens
                self.buckets[key] = (max_tokens - 1, now)
                return True, 0
            
            tokens, last_update = self.buckets[key]
            
            # Calculate tokens to add based on time elapsed
            time_elapsed = now - last_update
            tokens_to_add = time_elapsed * refill_rate
            tokens = min(max_tokens, tokens + tokens_to_add)
            
            if tokens >= 1:
                # Allow request and consume token
                self.buckets[key] = (tokens - 1, now)
                return True, 0
            else:
                # Rate limit exceeded
                retry_after = int((1 - tokens) / refill_rate) + 1
                self.buckets[key] = (tokens, now)
                return False, retry_after
    
    async def cleanup_old_entries(self, max_age_seconds: int = 3600):
        """Remove old entries to prevent memory leak"""
        async with self.lock:
            now = time.time()
            keys_to_remove = [
                key for key, (_, last_update) in self.buckets.items()
                if now - last_update > max_age_seconds
            ]
            for key in keys_to_remove:
                del self.buckets[key]


# Global rate limiter instance
rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce rate limits on API requests"""
    
    def __init__(self, app):
        super().__init__(app)
        # Start cleanup task
        asyncio.create_task(self._periodic_cleanup())
    
    async def _periodic_cleanup(self):
        """Periodically clean up old rate limit entries"""
        while True:
            await asyncio.sleep(600)  # Every 10 minutes
            await rate_limiter.cleanup_old_entries()
    
    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier from request"""
        # Try to get user ID from auth if available
        if hasattr(request.state, "user") and request.state.user:
            return f"user:{request.state.user.id}"
        
        # Fall back to IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return f"ip:{forwarded_for.split(',')[0].strip()}"
        
        client_host = request.client.host if request.client else "unknown"
        return f"ip:{client_host}"
    
    def _get_endpoint_category(self, path: str, method: str) -> Tuple[str, int, float]:
        """Determine rate limit category for endpoint
        
        Returns:
            Tuple of (category, max_tokens, refill_rate)
        """
        # Authentication endpoints
        if path.startswith("/api/auth/"):
            return (
                "auth",
                RateLimitConfig.AUTH_LIMIT,
                RateLimitConfig.AUTH_LIMIT / RateLimitConfig.AUTH_WINDOW
            )
        
        # File upload endpoints
        if "/upload" in path and method == "POST":
            return (
                "upload",
                RateLimitConfig.UPLOAD_LIMIT,
                RateLimitConfig.UPLOAD_LIMIT / RateLimitConfig.UPLOAD_WINDOW
            )
        
        # OpenAI-dependent endpoints (transcription, grading)
        if any(keyword in path for keyword in ["/transcripts/", "/grading/"]):
            if method == "POST" or "retry" in path:
                return (
                    "openai",
                    RateLimitConfig.OPENAI_LIMIT,
                    RateLimitConfig.OPENAI_LIMIT / RateLimitConfig.OPENAI_WINDOW
                )
        
        # General API endpoints
        return (
            "general",
            RateLimitConfig.GENERAL_LIMIT,
            RateLimitConfig.GENERAL_LIMIT / RateLimitConfig.GENERAL_WINDOW
        )
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health check
        if request.url.path in ["/", "/health"]:
            return await call_next(request)
        
        client_id = self._get_client_id(request)
        category, max_tokens, refill_rate = self._get_endpoint_category(
            request.url.path,
            request.method
        )
        
        is_allowed, retry_after = await rate_limiter.is_allowed(
            client_id,
            category,
            max_tokens,
            refill_rate
        )
        
        if not is_allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after": retry_after
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        response = await call_next(request)
        return response


from fastapi.responses import JSONResponse
