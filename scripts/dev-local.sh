#!/bin/bash

echo "🚀 Starting E-Clean Local Development Setup"
echo "This will run frontend locally with Docker services (Redis, DB, Backend)"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "📦 Starting Docker services (Backend, Database, Redis)..."
docker compose -f docker-compose.dev.yml up -d backend db redis

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "🔧 Installing frontend dependencies..."
cd frontend && npm install

echo "🚀 Starting frontend development server..."
echo "Frontend will be available at: http://localhost:5173"
echo "Backend API available at: http://localhost:8000"
echo "Redis available at: localhost:6379"
echo ""
echo "Press Ctrl+C to stop the frontend server"
echo "Run 'docker compose -f docker-compose.dev.yml down' to stop Docker services"
echo ""

# Set environment variables for local development
export REACT_APP_API_URL=http://localhost:8000/api
export REACT_APP_WS_URL=ws://localhost:8000/ws

# Start the development server
npm run dev