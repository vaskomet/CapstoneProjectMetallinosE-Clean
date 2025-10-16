# Docker Development Commands

## Daily Development Workflow

### Starting Your Development Environment
```bash
# Start all services
docker compose -f docker-compose.dev.yml up -d

# Start with logs visible
docker compose -f docker-compose.dev.yml up
```

### Stopping Your Development Environment
```bash
# Stop all services
docker compose -f docker-compose.dev.yml down

# Stop and remove volumes (reset database)
docker compose -f docker-compose.dev.yml down -v
```

### Managing Django in Docker

#### Database Operations
```bash
# Run migrations
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Create new migration
docker compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

# Create superuser
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Django shell
docker compose -f docker-compose.dev.yml exec backend python manage.py shell

# Collect static files
docker compose -f docker-compose.dev.yml exec backend python manage.py collectstatic
```

#### Running Tests
```bash
# Run Django tests
docker compose -f docker-compose.dev.yml exec backend python manage.py test

# Run specific test
docker compose -f docker-compose.dev.yml exec backend python manage.py test cleaning_jobs.tests
```

### Managing Frontend in Docker

#### Package Management
```bash
# Install new npm package
docker compose -f docker-compose.dev.yml exec frontend npm install <package-name>

# Run frontend tests
docker compose -f docker-compose.dev.yml exec frontend npm test

# Build production version
docker compose -f docker-compose.dev.yml exec frontend npm run build
```

### Debugging and Logs

#### View Logs
```bash
# All services logs
docker compose -f docker-compose.dev.yml logs -f

# Specific service logs
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend
docker compose -f docker-compose.dev.yml logs -f db
docker compose -f docker-compose.dev.yml logs -f redis
```

#### Access Container Shell
```bash
# Backend container bash
docker compose -f docker-compose.dev.yml exec backend bash

# Frontend container bash
docker compose -f docker-compose.dev.yml exec frontend sh

# Database container
docker compose -f docker-compose.dev.yml exec db psql -U ecloud_user -d ecloud_db
```

### Rebuilding Services
```bash
# Rebuild specific service
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml build frontend

# Rebuild and restart all
docker compose -f docker-compose.dev.yml up --build -d
```

### Quick Status Check
```bash
# Check service status
docker compose -f docker-compose.dev.yml ps

# Check service health
docker compose -f docker-compose.dev.yml top
```

## Development Tips

1. **Code Changes**: Edit files locally - they're automatically synced to containers
2. **Database Changes**: Always run migrations after model changes
3. **New Dependencies**: 
   - Python: Add to `requirements.txt` then rebuild backend
   - Node: Use `docker compose exec frontend npm install`
4. **Environment Variables**: Edit `.env.dev` file and restart services
5. **Port Conflicts**: If ports are busy, change them in `docker-compose.dev.yml`

## Troubleshooting

### Services Won't Start
```bash
# Check what's using the ports
lsof -i :3000 -i :8000 -i :5432 -i :6379

# Force recreate containers
docker compose -f docker-compose.dev.yml up --force-recreate -d
```

### Database Issues
```bash
# Reset database completely
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d db
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

### Clear Docker Cache
```bash
# Clean up unused containers and images
docker system prune -a
```