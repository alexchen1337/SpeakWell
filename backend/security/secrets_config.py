"""Secrets Management Configuration

Provides secure secrets loading from environment variables with validation.
In production, integrate with proper secrets management systems like:
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- Google Secret Manager
"""
import os
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv
import sys


class SecretsConfig:
    """Centralized secrets management"""
    
    def __init__(self):
        # Load environment variables
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        load_dotenv(dotenv_path=env_path)
        
        self._validate_required_secrets()
    
    def _validate_required_secrets(self):
        """Validate that all required secrets are present"""
        required_secrets = [
            "OPENAI_API_KEY",
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "JWT_SECRET_KEY",
        ]
        
        missing = []
        for secret in required_secrets:
            if not os.getenv(secret):
                missing.append(secret)
        
        if missing:
            print(
                f"ERROR: Missing required environment variables: {', '.join(missing)}",
                file=sys.stderr
            )
            print(
                "Please ensure all required secrets are set in your .env file or environment.",
                file=sys.stderr
            )
            # In production, you might want to sys.exit(1) here
    
    @property
    def openai_api_key(self) -> str:
        """Get OpenAI API key"""
        key = os.getenv("OPENAI_API_KEY", "")
        if not key:
            raise ValueError("OPENAI_API_KEY not configured")
        return key
    
    @property
    def supabase_url(self) -> str:
        """Get Supabase URL"""
        url = os.getenv("SUPABASE_URL", "")
        if not url:
            raise ValueError("SUPABASE_URL not configured")
        return url
    
    @property
    def supabase_service_role_key(self) -> str:
        """Get Supabase service role key"""
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY not configured")
        return key
    
    @property
    def jwt_secret_key(self) -> str:
        """Get JWT secret key"""
        key = os.getenv("JWT_SECRET_KEY", "")
        if not key:
            raise ValueError("JWT_SECRET_KEY not configured")
        return key
    
    @property
    def csrf_secret_key(self) -> str:
        """Get or generate CSRF secret key"""
        key = os.getenv("CSRF_SECRET_KEY")
        if not key:
            # Generate a secure random key (should be persisted in production)
            import secrets
            key = secrets.token_hex(32)
            print(
                f"WARNING: CSRF_SECRET_KEY not set. Using generated key: {key}",
                file=sys.stderr
            )
            print(
                "Please add this to your .env file: CSRF_SECRET_KEY=" + key,
                file=sys.stderr
            )
        return key
    
    @property
    def environment(self) -> str:
        """Get environment (development, staging, production)"""
        return os.getenv("ENVIRONMENT", "development")
    
    @property
    def frontend_url(self) -> str:
        """Get frontend URL for CORS"""
        return os.getenv("FRONTEND_URL", "http://localhost:3000")


# Global secrets instance
secrets_config = SecretsConfig()


# Production-ready secrets management example:
"""
For production deployments, replace the above with a proper secrets manager:

Example with AWS Secrets Manager:

import boto3
import json

class AWSSecretsConfig:
    def __init__(self, secret_name: str, region: str = "us-east-1"):
        self.client = boto3.client('secretsmanager', region_name=region)
        self.secret_name = secret_name
        self._secrets = None
    
    def _load_secrets(self):
        if self._secrets is None:
            response = self.client.get_secret_value(SecretId=self.secret_name)
            self._secrets = json.loads(response['SecretString'])
    
    @property
    def openai_api_key(self) -> str:
        self._load_secrets()
        return self._secrets['OPENAI_API_KEY']
    
    # ... other properties

# Usage:
# secrets_config = AWSSecretsConfig('speakwell/production')
"""
