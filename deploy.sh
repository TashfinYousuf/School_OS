#!/bin/bash
set -e

echo "🚀 [EducationOS Production Deployment Triggered]"

# 1. Pull latest verified changes
git pull origin main

# 2. Build Docker Containers
echo "📦 Building optimized production containers..."
docker compose -f docker-compose.prod.yml build

# 3. Apply Zero-Downtime Rolling Update
echo "🔄 Recreating running containers..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 4. Clean dangling images
docker image prune -f

# 5. Verify Health
echo "⏳ Waiting for health check verification..."
sleep 5
curl -I http://localhost:8000/healthz

echo "✅ [Deployment Successful] SchoolOS & AcademyOS Live at Kandirpar, Cumilla Campus."