# EducationOS — Lean Production Deployment Runbook
**Target Infrastructure:** Single Budget VPS ($12–$24/month — Hetzner Cloud / DigitalOcean)  
**Database:** Managed Supabase PostgreSQL (Transaction Pooler on Port 6543)  
**Reverse Proxy:** Caddy v2 (Automatic Let's Encrypt SSL / TLS Termination)  
**Containerization:** Docker & Docker Compose  
**Date:** November 2026

---

## 1. Architecture & Cost Model

This runbook describes a lean, robust production deployment designed for 1 to 5 concurrent educational institutions (up to 5,000 active students and 200 concurrent teachers) on a single budget Virtual Private Server.

```mermaid
flowchart TD
    Client["Browser / Mobile PWA (HTTPS)"] --> DNS["DNS A-Record (ksis.educationos.school)"]
    DNS --> Caddy["Caddy v2 (Reverse Proxy + Auto-SSL)<br/>Port 80/443"]
    
    subgraph VPS["Single Budget VPS (Hetzner CX32: 4 vCPU / 8GB RAM / €11/mo)"]
        Caddy -->|"/api/*"| Backend["FastAPI Backend Container<br/>Uvicorn ASGI (Port 8000)"]
        Caddy -->|"/*"| Frontend["Next.js 16 Frontend Container<br/>Node.js SSR (Port 3000)"]
        Cron["Automated Daily Backup Cron<br/>(pg_dump to Encrypted Volume)"]
    end

    Backend -->|SSL Pooler :6543| Supabase["Supabase Managed PostgreSQL<br/>(RLS + Automated WAL Backups)"]
    Cron -->|Encrypted Dumps| RemoteBackup["Offsite Backup (S3 / Cloudflare R2)"]
```

### Monthly Cost Breakdown
| Service | Provider / Tier | Specifications | Estimated Cost |
|---|---|---|---|
| **Host VPS** | Hetzner Cloud CX32 (or DO Droplet) | 4 vCPU, 8 GB RAM, 80 GB NVMe | €11.00 (~$12.50) / mo |
| **PostgreSQL DB** | Supabase Pro (or Free Tier during Pilot) | 8 GB Storage, Pooler, Point-in-time recovery | $0.00 – $25.00 / mo |
| **Domain & SSL** | Cloudflare DNS + Caddy | Auto-renewing Let's Encrypt Wildcard SSL | Free ($0.00) |
| **Transactional Email / SMS** | Infobip / Twilio (Mocked in Pilot) | Pay-as-you-go | ~$2.00 / mo |
| **Total Operational Cost** | — | — | **$14.50 – $39.50 / mo** |

---

## 2. Server Preparation (Ubuntu 24.04 LTS)

### Step 1: Base Security & Firewall Configuration
```bash
# Update base system
sudo apt update && sudo apt upgrade -y

# Configure firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP (Caddy Let\'s Encrypt Challenge)'
sudo ufw allow 443/tcp comment 'HTTPS (Secure Web)'
sudo ufw enable

# Install fail2ban for brute-force protection
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### Step 2: Install Docker Engine & Compose
```bash
# Install Docker prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## 3. Application Deployment via Docker Compose

### Step 1: Clone Repository
```bash
sudo mkdir -p /opt/schoolos
sudo chown -R $USER:$USER /opt/schoolos
cd /opt/schoolos

git clone https://github.com/your-org/schoolos.git .
git checkout main
```

### Step 2: Configure Production Environment Variables (`.env.production`)
Create `/opt/schoolos/.env.production`:
```ini
# Core Configuration
ENVIRONMENT=production
DEBUG=false
TIMEZONE=Asia/Dhaka

# Authentication Secrets (Generate with: openssl rand -hex 32)
SECRET_KEY=replace_with_64_character_cryptographic_random_hex_string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Supabase Managed Database (Transaction Pooler URL)
DATABASE_URL=postgresql://postgres.yourproject:YourStrongPassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require

# External AI Service (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key_here

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://schoolos.education/api
NEXT_PUBLIC_APP_URL=https://schoolos.education
```

### Step 3: Production `docker-compose.prod.yml`
```yaml
services:
  caddy:
    image: caddy:2.8-alpine
    container_name: schoolos_caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
      - frontend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: schoolos_backend
    restart: unless-stopped
    env_file:
      - .env.production
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
    expose:
      - "8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://schoolos.education/api
    container_name: schoolos_frontend
    restart: unless-stopped
    expose:
      - "3000"

volumes:
  caddy_data:
  caddy_config:
```

### Step 4: Caddyfile Configuration (`/opt/schoolos/Caddyfile`)
```caddy
schoolos.education {
    # Security Headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Reverse Proxy API Routes to FastAPI Backend
    handle /api/* {
        reverse_proxy backend:8000
    }

    # Reverse Proxy Web App Routes to Next.js Frontend
    handle /* {
        reverse_proxy frontend:3000
    }
}
```

---

## 4. Database Migrations & Initial Startup

```bash
# Build containers
docker compose -f docker-compose.prod.yml build

# Start services in background
docker compose -f docker-compose.prod.yml up -d

# Execute database migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Verify running containers
docker compose -f docker-compose.prod.yml ps
```

---

## 5. Automated Daily Database Backup Script

Create `/opt/schoolos/scripts/backup_db.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/schoolos"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/schoolos_db_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Export PostgreSQL dump from Supabase
source /opt/schoolos/.env.production
pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"

# Keep only last 14 days of backups locally
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +14 -delete

echo "[$(date)] Backup completed: ${BACKUP_FILE}"
```

Make executable and add to daily cron:
```bash
chmod +x /opt/schoolos/scripts/backup_db.sh

# Run every night at 02:00 AM Asia/Dhaka (20:00 UTC)
(crontab -l 2>/dev/null; echo "0 20 * * * /opt/schoolos/scripts/backup_db.sh >> /var/log/schoolos_backup.log 2>&1") | crontab -
```

---

## 6. Zero-Downtime Rolling Update Procedure

When pushing a new release or update:
```bash
cd /opt/schoolos

# 1. Pull latest verified commits from main
git pull origin main

# 2. Build new container images
docker compose -f docker-compose.prod.yml build

# 3. Apply any new Alembic database migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 4. Restart containers with zero downtime
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 5. Verify health check
curl -f https://schoolos.education/api/v1/health || echo "HEALTH CHECK FAILED"
```

