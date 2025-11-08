#!/bin/bash

# Script to run Django backend locally using Docker's PostgreSQL
# This ensures the local backend connects to the same database as Docker

# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✅ Loaded environment variables from .env.local"
else
    echo "❌ .env.local file not found!"
    exit 1
fi

# Check if Docker services are running
if ! docker-compose -f ../docker-compose.dev.yml ps | grep -q "ecloud_db_dev.*Up"; then
    echo "⚠️  Docker database is not running!"
    echo "Starting Docker database and Redis..."
    cd ..
    docker-compose -f docker-compose.dev.yml up -d db redis
    cd backend
    echo "Waiting for database to be ready..."
    sleep 5
fi

# Run Django development server
echo "🚀 Starting Django development server..."
echo "📊 Using PostgreSQL at localhost:5432"
echo "🔴 Using Redis at localhost:6379"
echo ""
python manage.py runserver 0.0.0.0:8000
