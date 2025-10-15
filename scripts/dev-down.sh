#!/bin/bash
# E-Clean Platform Docker Development Teardown

echo "🛑 Stopping E-Clean Platform Development Environment..."

# Stop all services
docker compose -f docker-compose.dev.yml down

# Optionally remove volumes (uncomment if you want to reset data)
# echo "🗑️ Removing volumes..."
# docker compose -f docker-compose.dev.yml down -v

# Show remaining containers
echo "📋 Remaining Docker containers:"
docker ps -a | grep ecloud || echo "No E-Clean containers running"

echo "✅ Development environment stopped"