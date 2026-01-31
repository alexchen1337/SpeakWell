# Security Features Quick Reference

## CSRF Protection

### Get Token
```bash
curl http://localhost:8000/api/csrf-token \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Use Token
```bash
curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -F "file=@audio.mp3"
```

### JavaScript Example
```javascript
// Store token globally or in state
let csrfToken = null;

// Fetch token (once per session or when expired)
const fetchCsrfToken = async () => {
  const response = await fetch('/api/csrf-token', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  csrfToken = data.csrf_token;
};

// Include in all state-changing requests
const deleteAudio = async (audioId) => {
  await fetch(`/api/audio/${audioId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-CSRF-Token': csrfToken
    }
  });
};
```

---

## Rate Limits

| Endpoint Category | Limit | Window | Example Endpoints |
|------------------|-------|--------|------------------|
| General API | 100 requests | 1 minute | /api/audio, /api/rubrics |
| OpenAI Operations | 10 requests | 1 minute | /api/transcripts/*/retry, /api/grading |
| File Uploads | 20 uploads | 1 minute | /api/audio/upload |
| Authentication | 10 attempts | 1 minute | /api/auth/login |

### Rate Limit Response
```json
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "detail": "Rate limit exceeded",
  "retry_after": 42
}
```

### Handling in Frontend
```javascript
const apiCall = async (url, options) => {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return apiCall(url, options);  // Retry
  }
  
  return response;
};
```

---

## File Upload Security

### Supported Formats
- ✅ MP3 (`.mp3`)
- ✅ WAV (`.wav`)
- ✅ OGG (`.ogg`)
- ✅ FLAC (`.flac`)
- ✅ M4A/AAC (`.m4a`, `.aac`)
- ✅ WebM (`.webm`, `.weba`)
- ✅ Opus (`.opus`)

### Size Limit
- Maximum: **100 MB** per file

### Security Checks
1. **Magic Byte Validation**: Verifies file is actually audio
2. **Extension Check**: Must match allowed list
3. **Filename Sanitization**: Removes path traversal attempts
4. **Size Validation**: Enforces 100MB limit

### Blocked Filenames
```bash
# These will be rejected:
../../../etc/passwd          # Path traversal
malicious.mp3\x00.exe        # Null byte injection
file/with/slashes.mp3        # Directory separators
really_long_name_over_255... # Too long
```

---

## Security Headers

### Verify Headers
```bash
curl -I http://localhost:8000/
```

### Expected Headers
```
Content-Security-Policy: default-src 'self'; connect-src 'self' ...
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), ...
```

---

## Environment Variables

### Required
```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET_KEY=...  # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
CSRF_SECRET_KEY=... # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
```

### Optional
```bash
ENVIRONMENT=production
FRONTEND_URL=https://yourdomain.com
UPLOAD_DIR=uploads
SIGNED_URL_EXPIRES_IN=7200
```

---

## Testing Security

### Test CSRF Protection
```bash
# Should fail (no token)
curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.mp3"

# Should succeed
CSRF=$(curl -s http://localhost:8000/api/csrf-token \
  -H "Authorization: Bearer $TOKEN" | jq -r '.csrf_token')

curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  -F "file=@test.mp3"
```

### Test File Validation
```bash
# Create fake audio file
echo "malicious content" > fake.mp3

# Should be rejected (magic byte validation fails)
curl -X POST http://localhost:8000/api/audio/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  -F "file=@fake.mp3"
```

### Test Rate Limiting
```bash
# Send 15 requests (limit is 10/min for transcription)
for i in {1..15}; do
  curl -X POST http://localhost:8000/api/transcripts/xxx/retry \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-CSRF-Token: $CSRF"
done
# First 10 should succeed, rest should return 429
```

---

## Common Errors

### CSRF Token Missing
```json
{
  "detail": "CSRF token missing"
}
```
**Solution**: Include `X-CSRF-Token` header in request

### Invalid CSRF Token
```json
{
  "detail": "Invalid or expired CSRF token"
}
```
**Solution**: 
- Fetch new token from `/api/csrf-token`
- Check `CSRF_SECRET_KEY` is set correctly
- Verify token hasn't expired (24 hour limit)

### Rate Limit Exceeded
```json
{
  "detail": "Rate limit exceeded",
  "retry_after": 42
}
```
**Solution**: Wait `retry_after` seconds before retrying

### File Validation Failed
```json
{
  "detail": "File content does not match any known audio format (magic byte validation failed)"
}
```
**Solution**: 
- Ensure file is valid audio (not renamed executable)
- Check format is supported (MP3, WAV, OGG, etc.)
- Verify file isn't corrupted

---

## Customization

### Adjust Rate Limits
```python
# backend/security/rate_limiting.py
class RateLimitConfig:
    GENERAL_LIMIT = 200      # Increase from 100
    OPENAI_LIMIT = 20        # Increase from 10
    UPLOAD_LIMIT = 30        # Increase from 20
    AUTH_LIMIT = 15          # Increase from 10
```

### Add Audio Format
```python
# backend/security/file_validation.py
AUDIO_MAGIC_BYTES = {
    # Existing formats...
    b'\x1a\x45\xdf\xa3': 'audio/matroska',  # Add MKA
}

ALLOWED_AUDIO_EXTENSIONS = {
    # Existing extensions...
    '.mka',  # Add MKA extension
}
```

### Exempt Endpoint from CSRF
```python
# backend/security/csrf_protection.py
EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/public/endpoint",  # Add your endpoint
}
```

### Customize CSP
```python
# backend/security/headers.py
csp_directives = [
    "default-src 'self'",
    "connect-src 'self' https://yourapi.com",  # Add your domain
    # ...
]
```

---

## Monitoring

### Security Events to Monitor
```bash
# CSRF failures (investigate if high)
grep "CSRF token" /var/log/speakwell/error.log | wc -l

# Rate limit hits per hour
grep "429" /var/log/speakwell/access.log | grep "$(date +%Y-%m-%d:%H)" | wc -l

# File validation failures
grep "magic byte validation failed" /var/log/speakwell/error.log

# Path traversal attempts
grep "path traversal" /var/log/speakwell/error.log
```

### Set Up Alerts
```bash
# Alert if CSRF failures > 100/hour
if [ $(grep "CSRF" /var/log/speakwell/error.log | grep "$(date +%Y-%m-%d:%H)" | wc -l) -gt 100 ]; then
  echo "High CSRF failure rate detected" | mail -s "Security Alert" admin@example.com
fi
```

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] All secrets in environment variables (not code)
- [ ] `ENVIRONMENT=production` set
- [ ] HTTPS configured
- [ ] Frontend updated with CSRF support
- [ ] Rate limits tested
- [ ] Security headers verified
- [ ] Monitoring configured
- [ ] Backups enabled

### Deploy Command
```bash
# 1. Update code
git pull origin security-fixes

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Set environment
export ENVIRONMENT=production

# 4. Restart service
sudo systemctl restart speakwell

# 5. Verify
curl -I https://api.yourdomain.com/health
```

---

## Need Help?

- 📚 **Full Documentation**: See `SECURITY.md`
- 🔧 **Implementation Guide**: See `docs/SECURITY_IMPLEMENTATION.md`
- 🚀 **Deployment Guide**: See `docs/DEPLOYMENT.md`
- 🐛 **Issues**: https://github.com/alexchen1337/SpeakWell/issues
