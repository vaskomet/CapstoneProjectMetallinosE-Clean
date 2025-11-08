# E-Clean Platform

## Project Overview

The E-Clean Platform is a modern web application designed to connect clients with professional cleaning service providers. It aims to streamline the process of booking, managing, and paying for cleaning services through an intuitive and efficient online portal.

### Core Objectives
- **User Authentication & Authorization:** Secure registration and login for clients and cleaners with role-based access control.
- **Service Booking & Scheduling:** An easy-to-use system for clients to book cleaning appointments based on availability.
- **Payment Processing:** Integrated payment gateway for seamless and secure transactions.
- **Real-Time Notifications:** Automated alerts for booking confirmations, reminders, and updates.

### Tech Stack
- **Backend:**
  - **Framework:** Django 5.2
  - **API:** Django Rest Framework (DRF)
  - **Authentication:** JWT (JSON Web Tokens)
  - **WebSockets:** Django Channels (for real-time features)
  - **Realtime transport:** Channels over Redis (no Celery workers configured)
  - **Event bus:** Redis Pub/Sub via `backend/core/events.py`
- **Frontend:**
  - **Framework:** React 19.1.1
  - **Styling:** Tailwind CSS
  - **Maps:** Leaflet.js with react-leaflet
  - **Calendar:** FullCalendar.js
- **Database:**
  - **Development (local):** SQLite fallback when PostgreSQL env vars are not set
  - **Development (Docker):** PostgreSQL (recommended)
  - **Production:** PostgreSQL
- **Infrastructure:**
  - **Message Broker:** Redis (for WebSocket channels and Celery)
  - **Containerization:** Docker & Docker Compose
  - **CI/CD:** GitHub Actions
  - **Hosting:** (To be determined - e.g., Heroku, AWS, Vercel)

## Real-Time Features Scope

### Primary Feature: In-App Chat System
- **1:1 Chat:** Direct messaging between clients and cleaners tied to specific bookings
- **Auto-Room Creation:** Chat rooms automatically created when a cleaning job is accepted
- **Job Context:** Chat messages include job details and status for better communication
- **Message Persistence:** Chat history stored in database for reference and dispute resolution
- **Unified Consumer:** Single WebSocket endpoint `ws/chat/` multiplexes all rooms (legacy per-room endpoints are deprecated)

### Secondary Feature: Real-Time Notifications
- **Booking Updates:** Instant notifications for status changes (accepted, started, completed)
- **New Messages:** Real-time alerts for new chat messages
- **Job Reminders:** Automated notifications for upcoming appointments
- **System Alerts:** Important platform updates and maintenance notifications

### Security Requirements
- **JWT Authentication:** WebSocket connections authenticated using JWT tokens
- **HTTPS/WSS:** Enforce secure WebSocket connections (wss://) in production
- **Room Authorization:** Validate participants to prevent unauthorized chat access
- **Data Encryption:** All chat messages encrypted in transit and at rest
- **Rate Limiting:** Implement message rate limiting to prevent spam

### Accessibility Standards
- **Screen Reader Support:** ARIA labels and landmarks for chat components
- **Keyboard Navigation:** Full keyboard accessibility for chat interface
- **High Contrast:** Support for high contrast mode in chat UI
- **Text Scaling:** Responsive text sizing for chat messages
- **Focus Management:** Proper focus handling for real-time updates

### Performance Goals
- **Concurrent Users:** Support minimum 100 concurrent chat users initially
- **Message Latency:** Sub-500ms message delivery in optimal conditions
- **Scalability:** Redis clustering support for horizontal scaling
- **Connection Recovery:** Automatic reconnection handling for WebSocket drops
- **Mobile Optimization:** Optimized for mobile device battery and bandwidth

### Technical Implementation
- **WebSocket Protocol:** Django Channels with Redis channel layer
- **Message Queue:** Celery for background notification processing
- **Database Design:** Optimized chat models with proper indexing
- **Frontend Integration:** React hooks for WebSocket management
- **Testing Strategy:** Unit tests, integration tests, and load testing

### Database selection in development
- Local runs (without Docker): Django uses SQLite unless `POSTGRES_*` variables are set in `.env.dev.local`.
- Docker development: `docker-compose.dev.yml` provides PostgreSQL and Redis on localhost; keep `POSTGRES_*` enabled to use Postgres.

### WebSocket endpoints
- Unified chat: `ws/chat/`
- Notifications: `ws/notifications/<user_id>/`
- Legacy (deprecated): `ws/chat/<room_name>/`, `ws/job_chat/<job_id>/`

### Branching Strategy
- **`main`:** This branch contains production-ready code. All deployments to the live server are made from this branch.
- **`dev`:** This is the primary integration branch. All feature branches are merged into `dev` before being promoted to `main`.
