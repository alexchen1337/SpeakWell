"""Security Headers Middleware

Adds comprehensive security headers to all responses.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import os


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all HTTP responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Content Security Policy
        # Restrict sources for various content types
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        csp_directives = [
            "default-src 'self'",
            f"connect-src 'self' {frontend_url} https://api.openai.com https://*.supabase.co",
            "font-src 'self' data:",
            "img-src 'self' data: https:",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Note: Consider tightening this
            "style-src 'self' 'unsafe-inline'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS Protection (legacy but still useful for older browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Force HTTPS (if in production)
        if os.getenv("ENVIRONMENT") == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
        
        # Referrer Policy - only send origin on cross-origin requests
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy - disable unnecessary browser features
        permissions_directives = [
            "geolocation=()",
            "microphone=(self)",  # Allow microphone for audio recording
            "camera=()",
            "payment=()",
            "usb=()",
            "magnetometer=()",
            "gyroscope=()",
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_directives)
        
        # Remove potentially revealing headers
        response.headers.pop("Server", None)
        response.headers.pop("X-Powered-By", None)
        
        return response
