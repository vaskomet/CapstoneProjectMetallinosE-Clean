# 🐳 Docker Setup for E-Clean Platform

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git repository cloned

### Development Environment

**Start the entire stack:**
```bash
./scripts/dev-up.sh
```

**Or manually:**
```bash
docker compose -f docker-compose.dev.yml up --build -d
```

**Stop the stack:**
```bash
./scripts/dev-down.sh
```

**Or manually:**
```bash
docker compose -f docker-compose.dev.yml down
```

### Services & Ports

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | React app with Nginx |
| Backend API | http://localhost:8000/api | Django REST API |
| Admin Panel | http://localhost:8000/admin | Django admin |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache & message broker |

### Default Credentials

**Database:**
- Host: localhost:5432
- Database: ecloud_dev
- Username: ecloud_user
- Password: ecloud_dev_password

**Redis:**
- Host: localhost:6379
- Password: redis_dev_password

## 🛠️ Development Commands

### Backend Commands
```bash
# Django shell
docker compose -f docker-compose.dev.yml exec backend python manage.py shell

# Create superuser
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Run migrations
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Collect static files
docker compose -f docker-compose.dev.yml exec backend python manage.py collectstatic --noinput
```

### Database Commands
```bash
# Connect to PostgreSQL
docker compose -f docker-compose.dev.yml exec db psql -U ecloud_user -d ecloud_dev

# Backup database
docker compose -f docker-compose.dev.yml exec db pg_dump -U ecloud_user ecloud_dev > backup.sql

# Restore database
docker compose -f docker-compose.dev.yml exec -T db psql -U ecloud_user ecloud_dev < backup.sql
```

### Redis Commands
```bash
# Connect to Redis
docker compose -f docker-compose.dev.yml exec redis redis-cli -a redis_dev_password

# Monitor Redis
docker compose -f docker-compose.dev.yml exec redis redis-cli -a redis_dev_password monitor
```

### Logs & Debugging
```bash
# View logs for all services
docker compose -f docker-compose.dev.yml logs -f

# View logs for specific service
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend
docker compose -f docker-compose.dev.yml logs -f db
docker compose -f docker-compose.dev.yml logs -f redis
docker compose -f docker-compose.dev.yml logs -f celery

# Execute commands inside containers
docker compose -f docker-compose.dev.yml exec backend bash
docker compose -f docker-compose.dev.yml exec frontend sh
```

## 🏭 Production Deployment

### Environment Setup
1. Copy environment template:
   ```bash
   cp .env.prod.template .env.prod
   ```

2. Edit `.env.prod` with your production values

3. Deploy:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

### Production Features
- Nginx reverse proxy with SSL termination
- PostgreSQL with persistent volumes
- Redis with authentication
- Celery workers for background tasks
- Health checks for all services
- Automatic restarts

## 🔧 Troubleshooting

### Common Issues

**Docker not found:**
```bash
# Make sure Docker Desktop is running
open -a Docker
```

**Port conflicts:**
```bash
# Check what's using the ports
lsof -i :3000  # Frontend
lsof -i :8000  # Backend
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

**Database connection issues:**
```bash
# Check database container logs
docker compose -f docker-compose.dev.yml logs db

# Restart database service
docker compose -f docker-compose.dev.yml restart db
```

**Frontend build issues:**
```bash
# Rebuild frontend container
docker compose -f docker-compose.dev.yml build --no-cache frontend
```

**Clean everything:**
```bash
# Remove all containers and volumes
docker compose -f docker-compose.dev.yml down -v

# Remove images
docker compose -f docker-compose.dev.yml down --rmi all

# Prune Docker system
docker system prune -a
```

## 📦 Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Frontend   │  │   Backend    │  │    Celery    │     │
│  │  (Nginx)     │  │  (Django)    │  │  (Worker)    │     │
│  │  Port: 3000  │  │  Port: 8000  │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            │                              │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ PostgreSQL   │  │    Redis     │                      │
│  │ Port: 5432   │  │ Port: 6379   │                      │
│  └──────────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 Security Notes

- Environment files (`.env.prod`) contain sensitive data - never commit to Git
- Default passwords are for development only
- Production deployment requires proper SSL certificates
- Regular backups of PostgreSQL data volumes recommended
- Keep Docker images updated for security patches

## 📊 Monitoring

### Health Checks
All services include health checks accessible via:
```bash
docker compose -f docker-compose.dev.yml ps
```

### Resource Usage
```bash
# Container resource usage
docker stats

# Disk usage
docker system df
```