# Deployment Guide

This guide covers deploying the SpeakWell application with all security features enabled.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Security Configuration](#security-configuration)
4. [Deployment Options](#deployment-options)
5. [Production Checklist](#production-checklist)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher
- PostgreSQL 14+ (or Supabase account)
- OpenAI API account
- Domain name with SSL certificate (production)

## Environment Setup

### 1. Clone and Setup

```bash
git clone https://github.com/alexchen1337/SpeakWell.git
cd SpeakWell
```

### 2. Backend Configuration

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Variables

```bash
# Copy example env file
cp ../.env.example ../.env

# Generate secrets
python -c "import secrets; print(f'JWT_SECRET_KEY={secrets.token_hex(32)}')"
python -c "import secrets; print(f'CSRF_SECRET_KEY={secrets.token_hex(32)}')"

# Edit .env file with your values
nano ../.env
```

**Required variables**:
- `OPENAI_API_KEY`: From OpenAI platform
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: From Supabase project settings
- `JWT_SECRET_KEY`: Generated secret
- `CSRF_SECRET_KEY`: Generated secret
- `FRONTEND_URL`: Your frontend URL

### 4. Database Setup

If using Supabase:
```bash
# Database is automatically managed
# Just ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
```

If using standalone PostgreSQL:
```bash
# Create database
createdb speakwell

# Run migrations
alembic upgrade head
```

## Security Configuration

### 1. CSRF Protection

**Generate CSRF Secret**:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Add to `.env`:
```bash
CSRF_SECRET_KEY=your-generated-secret
```

**Frontend Integration**:
```javascript
// In your frontend app
const getCsrfToken = async () => {
  const response = await fetch(`${API_URL}/api/csrf-token`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return (await response.json()).csrf_token;
};

// Use in requests
const csrfToken = await getCsrfToken();
fetch(`${API_URL}/api/audio/upload`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken
  },
  body: formData
});
```

### 2. Rate Limiting Configuration

**Default Limits**:
- General API: 100 req/min
- OpenAI endpoints: 10 req/min
- File uploads: 20 uploads/min
- Authentication: 10 attempts/min

**Customize** in `backend/security/rate_limiting.py`:
```python
class RateLimitConfig:
    GENERAL_LIMIT = 200  # Increase if needed
    OPENAI_LIMIT = 20    # Based on your OpenAI tier
```

### 3. Security Headers

**Content-Security-Policy** is automatically applied.

**Customize** in `backend/security/headers.py` if needed:
```python
csp_directives = [
    "default-src 'self'",
    f"connect-src 'self' {frontend_url} https://your-cdn.com",
    # Add more as needed
]
```

### 4. File Upload Security

**Current Settings**:
- Max file size: 100MB
- Allowed formats: MP3, WAV, OGG, FLAC, M4A, WebM, Opus
- Magic byte validation: Enabled
- Path traversal protection: Enabled

**Customize** in `backend/security/file_validation.py`:
```python
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB

ALLOWED_AUDIO_EXTENSIONS = {
    '.mp3', '.wav',
    # Add more formats
}
```

## Deployment Options

### Option 1: AWS (Recommended)

#### Architecture
```
Route 53 (DNS)
    ↓
CloudFront (CDN + SSL)
    ↓
ALB (Load Balancer)
    ↓
ECS Fargate (Backend)
    ↓
RDS PostgreSQL
S3 (File Storage)
Secrets Manager
```

#### Steps

1. **Create Docker Image**:
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

2. **Build and Push**:
```bash
docker build -t speakwell-backend .
docker tag speakwell-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/speakwell:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/speakwell:latest
```

3. **Setup Secrets Manager**:
```bash
aws secretsmanager create-secret \
  --name speakwell/production \
  --secret-string '{
    "OPENAI_API_KEY": "sk-...",
    "JWT_SECRET_KEY": "...",
    "CSRF_SECRET_KEY": "..."
  }'
```

4. **Update Code to Use Secrets Manager**:
See `backend/security/secrets_config.py` for AWS example.

5. **Deploy to ECS**:
```bash
aws ecs create-cluster --cluster-name speakwell-prod
aws ecs create-service --cluster speakwell-prod --service-name backend ...
```

### Option 2: DigitalOcean

1. **Create Droplet**:
```bash
# Choose Ubuntu 22.04 LTS
# Minimum: 2GB RAM, 2 vCPUs
```

2. **Setup Server**:
```bash
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install python3.11 python3-pip nginx certbot python3-certbot-nginx -y

# Clone repository
git clone https://github.com/alexchen1337/SpeakWell.git
cd SpeakWell/backend

# Setup application
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
nano ../.env
```

3. **Setup Systemd Service**:
```bash
# Create service file
sudo nano /etc/systemd/system/speakwell.service
```

```ini
[Unit]
Description=SpeakWell API
After=network.target

[Service]
User=www-data
WorkingDirectory=/root/SpeakWell/backend
Environment="PATH=/root/SpeakWell/backend/venv/bin"
ExecStart=/root/SpeakWell/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable speakwell
sudo systemctl start speakwell
```

4. **Configure Nginx**:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. **Setup SSL**:
```bash
sudo certbot --nginx -d api.yourdomain.com
```

### Option 3: Heroku

1. **Create Heroku App**:
```bash
heroku create speakwell-api
```

2. **Configure Buildpacks**:
```bash
heroku buildpacks:add heroku/python
```

3. **Set Environment Variables**:
```bash
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set JWT_SECRET_KEY=...
heroku config:set CSRF_SECRET_KEY=...
heroku config:set ENVIRONMENT=production
```

4. **Create Procfile**:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

5. **Deploy**:
```bash
git push heroku security-fixes:main
```

## Production Checklist

### Security

- [ ] All secrets stored in secure secrets manager (not .env)
- [ ] HTTPS enforced (Strict-Transport-Security header)
- [ ] Environment set to "production"
- [ ] CSRF protection enabled and tested
- [ ] Rate limiting configured appropriately
- [ ] Security headers verified
- [ ] File upload validation tested with malicious files
- [ ] Firewall configured to restrict access
- [ ] Database access restricted to backend only
- [ ] SSH keys configured (no password authentication)

### Performance

- [ ] Database connection pooling configured
- [ ] CDN setup for static files
- [ ] Caching configured (Redis recommended)
- [ ] Load balancer setup (if needed)
- [ ] Auto-scaling configured

### Monitoring

- [ ] Application logging configured
- [ ] Error tracking (Sentry/Rollbar)
- [ ] Performance monitoring (New Relic/DataDog)
- [ ] Uptime monitoring
- [ ] Security event logging
- [ ] OpenAI API usage monitoring
- [ ] Alert notifications configured

### Backup

- [ ] Database automated backups
- [ ] File storage backups
- [ ] Backup restoration tested
- [ ] Disaster recovery plan documented

## Monitoring and Maintenance

### Logging

**Setup Application Logging**:
```python
# Add to main.py
import logging
from logging.handlers import RotatingFileHandler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('app.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)
```

### Monitoring Dashboard

**Key Metrics to Monitor**:
- Request rate and latency
- Error rate (4xx, 5xx)
- Rate limit hits
- CSRF validation failures
- File upload success/failure rate
- OpenAI API usage and costs
- Database performance
- Memory and CPU usage

### Maintenance Tasks

**Daily**:
- Check error logs
- Monitor API costs
- Review rate limit hits

**Weekly**:
- Review security logs
- Check disk space
- Verify backups

**Monthly**:
- Update dependencies
- Review and rotate secrets
- Security audit
- Performance optimization

**Quarterly**:
- Penetration testing
- Disaster recovery drill
- Review and update documentation

### Update Procedure

```bash
# 1. Pull latest changes
git pull origin main

# 2. Backup database
pg_dump speakwell > backup_$(date +%Y%m%d).sql

# 3. Update dependencies
pip install --upgrade -r requirements.txt

# 4. Run migrations
alembic upgrade head

# 5. Restart service
sudo systemctl restart speakwell

# 6. Verify deployment
curl https://api.yourdomain.com/health

# 7. Monitor logs
sudo journalctl -u speakwell -f
```

## Troubleshooting

### Common Issues

**Issue**: CSRF token errors
**Solution**: 
- Verify `CSRF_SECRET_KEY` is set and consistent
- Check frontend is sending token in `X-CSRF-Token` header
- Ensure token hasn't expired

**Issue**: Rate limiting too aggressive
**Solution**:
- Review rate limit logs
- Adjust limits in `RateLimitConfig`
- Consider implementing user tiers

**Issue**: File uploads failing
**Solution**:
- Check file size < 100MB
- Verify file format is supported
- Review security logs for validation failures
- Test with known-good audio file

**Issue**: High OpenAI costs
**Solution**:
- Review rate limiting on transcription endpoints
- Implement usage quotas per user
- Cache transcription results
- Monitor and alert on unusual usage

## Support

For deployment assistance:
- GitHub Issues: https://github.com/alexchen1337/SpeakWell/issues
- Documentation: See docs/ folder
- Security Issues: security@example.com

## License

See main repository LICENSE file.
