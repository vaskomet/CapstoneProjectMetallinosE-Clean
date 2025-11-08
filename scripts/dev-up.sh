#!/bin/bash
# E-Clean Platform Docker Development Setup

echo "🚀 Starting E-Clean Platform in Development Mode..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Load development environment variables
if [ -f .env.dev ]; then
    export $(cat .env.dev | xargs)
    echo "✅ Loaded development environment variables"
else
    echo "⚠️ .env.dev file not found. Using default values."
fi

# Build and start services
echo "🔨 Building and starting services..."
docker compose -f docker-compose.dev.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
docker compose -f docker-compose.dev.yml ps

# Show logs
echo "📋 Recent logs:"
docker compose -f docker-compose.dev.yml logs --tail=10

echo ""
echo "🎉 E-Clean Platform is running!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000/api"
echo "🗄️ Database: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo ""
echo "💡 Useful commands:"
echo "  docker compose -f docker-compose.dev.yml logs -f [service]  # Follow logs"
echo "  docker compose -f docker-compose.dev.yml exec backend python manage.py shell  # Django shell"
echo "  docker compose -f docker-compose.dev.yml down  # Stop all services"
echo "  docker compose -f docker-compose.dev.yml down -v  # Stop and remove volumes"