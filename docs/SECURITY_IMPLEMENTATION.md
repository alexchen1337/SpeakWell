# Security Implementation Guide

This document provides detailed implementation information for developers working with the security features.

## Architecture Overview

```
Client Request
    ↓
Security Headers Middleware (add headers to response)
    ↓
Rate Limit Middleware (check request limits)
    ↓
CSRF Protection Middleware (validate CSRF token)
    ↓
CORS Middleware (validate origin)
    ↓
Route Handler
    ↓
File Validation (if file upload)
    ↓
Business Logic
    ↓
Response
```

## Module: `backend/security/`

### 1. CSRF Protection (`csrf_protection.py`)

#### CSRFToken Class

**Token Format**: `{random_token}:{timestamp}:{hmac_signature}`

**Generation**:
```python
from security import get_csrf_token

token = get_csrf_token()
# Returns: "abc123...xyz:{timestamp}:def456...uvw"
```

**Validation**:
- Checks token format (3 parts separated by `:`)
- Verifies timestamp is within 24 hours
- Validates HMAC signature using `CSRF_SECRET_KEY`
- Uses constant-time comparison to prevent timing attacks

**Middleware Behavior**:
- Skips validation for GET, HEAD, OPTIONS requests
- Skips validation for exempt paths (auth endpoints, health check)
- Returns 403 Forbidden if token is missing or invalid

**Customization**:
```python
# In csrf_protection.py
CSRF_TOKEN_EXPIRY = timedelta(hours=48)  # Change expiry time

EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/public/endpoint",  # Add more exempt paths
}
```

### 2. File Validation (`file_validation.py`)

#### FileValidator Class

**Magic Byte Detection**:
```python
from security import FileValidator

# Read file contents
file_contents = await file.read()

# Check magic bytes
mime_type = FileValidator.check_magic_bytes(file_contents)
if mime_type:
    print(f"Detected: {mime_type}")
```

**Complete Validation**:
```python
try:
    sanitized_name, validated_mime = FileValidator.validate_audio_file(
        upload_file,
        file_contents
    )
except HTTPException as e:
    # Handle validation error
    print(f"Validation failed: {e.detail}")
```

**Adding New Audio Formats**:
```python
# In file_validation.py
AUDIO_MAGIC_BYTES = {
    # Existing formats...
    
    # Add new format
    b'\x1a\x45\xdf\xa3': 'audio/matroska',  # MKA files
}

ALLOWED_AUDIO_EXTENSIONS = {
    # Existing extensions...
    '.mka',  # Add new extension
}
```

**Path Traversal Protection**:
```python
# These will be blocked:
FileValidator.sanitize_filename("../../../etc/passwd")
FileValidator.sanitize_filename("..\\windows\\system32")
FileValidator.sanitize_filename("file\x00.txt.exe")

# Valid filename
FileValidator.sanitize_filename("my_presentation.mp3")
# Returns: "my_presentation.mp3"
```

### 3. Rate Limiting (`rate_limiting.py`)

#### RateLimiter Class (Token Bucket)

**Algorithm**:
1. Each client has a "bucket" of tokens
2. Each request consumes 1 token
3. Tokens refill at a constant rate
4. Request blocked if no tokens available

**Configuration**:
```python
class RateLimitConfig:
    # Adjust these values based on your needs
    GENERAL_LIMIT = 100  # requests
    GENERAL_WINDOW = 60  # seconds
    
    OPENAI_LIMIT = 10
    OPENAI_WINDOW = 60
```

**Client Identification**:
- Authenticated users: `user:{user_id}`
- Unauthenticated: `ip:{ip_address}`
- Respects `X-Forwarded-For` header for proxied requests

**Custom Rate Limits for Specific Endpoints**:
```python
# In rate_limiting.py, modify _get_endpoint_category()
def _get_endpoint_category(self, path: str, method: str):
    # Add custom endpoint
    if path.startswith("/api/custom/expensive-operation"):
        return (
            "custom",
            5,  # 5 requests
            5 / 60  # per minute
        )
    
    # ... existing logic
```

**Memory Management**:
- Automatic cleanup every 10 minutes
- Removes entries older than 1 hour
- Prevents memory leak with long-running servers

### 4. Security Headers (`headers.py`)

#### SecurityHeadersMiddleware

**Content-Security-Policy Customization**:
```python
# In headers.py
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
csp_directives = [
    "default-src 'self'",
    f"connect-src 'self' {frontend_url} https://api.openai.com",
    # Add your custom directives
    "font-src 'self' https://fonts.googleapis.com",
]
```

**Environment-Specific Behavior**:
```python
if os.getenv("ENVIRONMENT") == "production":
    # Strict HTTPS enforcement
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )
```

**Testing CSP**:
1. Enable CSP report-only mode:
   ```python
   response.headers["Content-Security-Policy-Report-Only"] = "; ".join(csp_directives)
   ```

2. Add report endpoint:
   ```python
   csp_directives.append("report-uri /api/csp-report")
   ```

3. Monitor violations before enforcing

### 5. Secrets Management (`secrets_config.py`)

#### SecretsConfig Class

**Usage**:
```python
from security.secrets_config import secrets_config

# Get secrets
openai_key = secrets_config.openai_api_key
supabase_url = secrets_config.supabase_url
```

**Production Integration (AWS Secrets Manager)**:
```python
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

# Replace in secrets_config.py:
# secrets_config = AWSSecretsConfig('speakwell/production')
```

## Integration with Existing Code

### Updated Endpoints

#### Audio Upload (`/api/audio/upload`)

**Before**:
```python
@router.post("/upload")
async def upload_audio(file: UploadFile):
    # No validation
    contents = await file.read()
    # Upload directly
```

**After**:
```python
@router.post("/upload")
async def upload_audio(file: UploadFile):
    contents = await file.read()
    
    # SECURITY: Validate file
    sanitized_name, mime_type = FileValidator.validate_audio_file(
        file, contents
    )
    
    # SECURITY: Validate size
    FileValidator.validate_file_size_streaming(len(contents))
    
    # Use validated values
    # Upload with sanitized_name and validated mime_type
```

## Testing Security Features

### 1. Test CSRF Protection

```bash
# Should fail (no token)
curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.mp3"
# Expected: 403 Forbidden

# Should succeed
CSRF_TOKEN=$(curl -s http://localhost:8000/api/csrf-token \
  -H "Authorization: Bearer $TOKEN" | jq -r '.csrf_token')

curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -F "file=@test.mp3"
# Expected: 200 OK
```

### 2. Test File Validation

```bash
# Test with malicious file
echo "#!/bin/bash\nrm -rf /" > malicious.mp3

curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -F "file=@malicious.mp3"
# Expected: 400 Bad Request (magic byte validation failed)
```

### 3. Test Rate Limiting

```bash
# Send 15 requests rapidly (limit is 10/min for OpenAI endpoints)
for i in {1..15}; do
  curl -X POST http://localhost:8000/api/transcripts/test-audio/retry \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-CSRF-Token: $CSRF_TOKEN"
done
# Expected: First 10 succeed, remaining return 429
```

### 4. Test Path Traversal Protection

```bash
# Try to upload file with path traversal
curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -F "file=@../../../etc/passwd"
# Expected: 400 Bad Request (invalid filename)
```

## Performance Considerations

### Rate Limiter Memory Usage

- Each entry: ~100 bytes (key + tuple)
- 1000 active users: ~100 KB
- Cleanup every 10 minutes prevents growth

### File Validation Overhead

- Magic byte check: O(1), <1ms
- Full file read: Required anyway for upload
- Sanitization: O(n) on filename length, negligible

### CSRF Token Generation

- HMAC-SHA256: ~0.1ms per token
- No database lookup required
- Stateless validation

## Troubleshooting

### CSRF Token Issues

**Problem**: "CSRF token missing"
**Solution**: Ensure frontend includes token in `X-CSRF-Token` header

**Problem**: "Invalid or expired CSRF token"
**Solution**: 
- Check system time synchronization
- Verify `CSRF_SECRET_KEY` is consistent
- Token may have expired (24 hour limit)

### Rate Limiting Issues

**Problem**: Legitimate users getting rate limited
**Solution**:
- Increase limits in `RateLimitConfig`
- Implement user-tier based limits (premium users get higher limits)
- Whitelist specific IPs

### File Upload Issues

**Problem**: Valid audio files rejected
**Solution**:
- Check file format is in `ALLOWED_AUDIO_EXTENSIONS`
- Verify magic bytes are in `AUDIO_MAGIC_BYTES`
- Check file size < 100MB

## Future Enhancements

1. **Advanced Rate Limiting**:
   - Redis-backed rate limiter for distributed systems
   - User-tier based limits
   - Burst allowance

2. **Enhanced File Validation**:
   - Virus scanning integration (ClamAV)
   - Audio content analysis
   - Metadata sanitization

3. **Audit Logging**:
   - Log all security events
   - Integration with SIEM systems
   - Automated threat detection

4. **WAF Integration**:
   - Cloudflare / AWS WAF
   - DDoS protection
   - Bot detection

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
