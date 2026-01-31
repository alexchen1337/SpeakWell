# Security Policy

## Security Features

This application implements comprehensive security measures to protect user data and prevent common vulnerabilities:

### 1. CSRF Protection

**Implementation**: Token-based CSRF protection for all state-changing operations (POST, PUT, PATCH, DELETE).

**How it works**:
- Clients must obtain a CSRF token from `/api/csrf-token` endpoint (requires authentication)
- All state-changing requests must include the token in the `X-CSRF-Token` header
- Tokens are time-limited (24 hours) and cryptographically signed using HMAC-SHA256

**Configuration**:
```bash
# In .env file
CSRF_SECRET_KEY=your-secret-key-here
```

**Client Usage**:
```javascript
// Get CSRF token
const response = await fetch('/api/csrf-token', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const { csrf_token } = await response.json();

// Use token in requests
await fetch('/api/audio/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': csrf_token
  },
  body: formData
});
```

### 2. Secure File Upload Handling

**Magic Byte Validation**: All uploaded files are validated using magic byte analysis to ensure they are genuine audio files, preventing:
- Executable files disguised as audio
- Malicious scripts
- File type misrepresentation

**Supported Audio Formats**:
- MP3 (magic bytes: `FF FB`, `FF F3`, `FF F2`, `ID3`)
- WAV (magic bytes: `RIFF`)
- OGG (magic bytes: `OggS`)
- FLAC (magic bytes: `fLaC`)
- M4A/AAC (magic bytes: ftyp box)
- WebM (magic bytes: `1A 45 DF A3`)

**Path Traversal Protection**:
- Filenames are sanitized to remove path components
- Detection and blocking of `..`, `/`, `\` characters
- Null byte removal
- Length validation (max 255 characters)

**File Size Limits**: Maximum 100MB per file

### 3. Rate Limiting

**Purpose**: Prevent API abuse and manage OpenAI API costs

**Rate Limits**:
- **General API endpoints**: 100 requests/minute
- **OpenAI endpoints** (transcription, grading): 10 requests/minute
- **File uploads**: 20 uploads/minute
- **Authentication**: 10 attempts/minute

**Implementation**: Token bucket algorithm with per-user and per-IP tracking

**Response**: HTTP 429 with `Retry-After` header when limit exceeded

### 4. Security Headers

**Content-Security-Policy (CSP)**:
- Restricts resource loading to trusted sources
- Prevents XSS attacks
- Blocks iframe embedding

**Other Headers**:
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `X-Frame-Options: DENY` - Prevents clickjacking
- `Strict-Transport-Security` - Forces HTTPS (production only)
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy` - Restricts browser features

### 5. Secrets Management

**Current Implementation**: Environment variables with validation

**Required Secrets**:
```bash
OPENAI_API_KEY=your-openai-key
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
JWT_SECRET_KEY=your-jwt-secret
CSRF_SECRET_KEY=your-csrf-secret
```

**Production Recommendations**:
- Use AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault
- Rotate secrets regularly
- Use different secrets for each environment
- Never commit secrets to version control

## Security Best Practices

### For Developers

1. **Keep dependencies updated**:
   ```bash
   pip install --upgrade -r requirements.txt
   ```

2. **Environment-specific configurations**:
   - Development: Relaxed CSP, detailed error messages
   - Production: Strict CSP, generic error messages, HTTPS only

3. **Logging and Monitoring**:
   - Log all security events (failed CSRF, rate limits, invalid files)
   - Monitor OpenAI API usage
   - Set up alerts for suspicious activity

4. **Regular Security Audits**:
   - Review dependencies for vulnerabilities
   - Test file upload with malicious files
   - Verify CSRF protection on all endpoints
   - Test rate limiting thresholds

### For Deployment

1. **HTTPS Only**: Always use HTTPS in production
2. **Firewall**: Restrict access to backend API
3. **Database Security**: Use strong passwords, restrict network access
4. **Backup**: Regular backups of database and uploaded files
5. **Monitoring**: Set up logging and alerting

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please email: security@example.com

**Please do NOT**:
- Open a public GitHub issue
- Disclose the vulnerability publicly before it's fixed

**Include in your report**:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work with you to resolve the issue.

## Security Checklist

- [x] CSRF protection on all state-changing endpoints
- [x] Magic byte validation for file uploads
- [x] Path traversal protection
- [x] Rate limiting on all API endpoints
- [x] Security headers (CSP, XSS, etc.)
- [x] Secrets management configuration
- [x] Input validation and sanitization
- [x] File size limits
- [x] Authenticated endpoint protection
- [ ] Security audit and penetration testing
- [ ] Production secrets management (AWS/Azure/Vault)
- [ ] WAF (Web Application Firewall) configuration
- [ ] DDoS protection
- [ ] Automated security scanning in CI/CD

## Updates and Changelog

### Version 2.0.0 (2026-01-30)
- Added CSRF protection middleware
- Implemented magic byte file validation
- Added comprehensive rate limiting
- Implemented security headers
- Added path traversal protection
- Created secrets management framework
- Updated all file upload endpoints with security validations

## License

See main repository LICENSE file.
