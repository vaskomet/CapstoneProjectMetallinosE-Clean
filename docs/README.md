# E-Clean Platform Documentation

**Comprehensive documentation for the E-Clean cleaning services marketplace platform**

---

## 📚 Documentation Structure

### **Getting Started**
- **[Development Setup](guides/DEVELOPMENT_SETUP.md)** - Complete setup instructions for local development
- **[Docker Setup](guides/DOCKER_SETUP.md)** - Docker-based development environment
- **[Docker Dev Commands](guides/DOCKER_DEV_COMMANDS.md)** - Common Docker operations reference
- **[Security Credentials Guide](guides/SECURITY_CREDENTIALS_GUIDE.md)** - Managing API keys and secrets safely

### **Architecture & Design**
- **[Payment Flow Explanation](architecture/PAYMENT_FLOW_EXPLANATION.md)** - Step-by-step payment integration with Stripe
- **[Two-Factor Authentication](architecture/TWO_FACTOR_AUTH_IMPLEMENTATION.md)** - TOTP-based 2FA system design
- **[Chat System Architecture](architecture/CHAT_ARCHITECTURE_ANALYSIS.md)** - Real-time messaging system
- **[Review & Rating System](architecture/REVIEW_RATING_SYSTEM_DESIGN.md)** - Cleaner rating system
- **[Hybrid Recommendation System](architecture/HYBRID_RECOMMENDATION_SYSTEM.md)** - ML-based cleaner matching
- **[Notification System](architecture/NOTIFICATION_SYSTEM_SUMMARY.md)** - Real-time notifications via WebSockets

### **Testing & Quality Assurance**
- **[Test Credentials](testing/TEST_CREDENTIALS.md)** - Development test user accounts
- **[Athens Test Users Guide](testing/ATHENS_TEST_USERS_GUIDE.md)** - Athens-specific test data
- **[Chat Testing Guide](testing/CHAT_TESTING_GUIDE.md)** - Real-time chat testing procedures
- **[Payment Testing Guide](testing/PAYMENT_TESTING_GUIDE.md)** - Stripe payment testing
- **[Review System Testing](testing/REVIEW_SYSTEM_TESTING_GUIDE.md)** - Testing review workflows

### **Development Standards**
- **[Development Standards](guides/DEVELOPMENT_STANDARDS.md)** - Code style, patterns, and best practices
- **[Database Best Practices](guides/DATABASE_BEST_PRACTICES.md)** - PostgreSQL patterns and migrations

### **Configuration**
- **[Email Verification & OAuth Setup](guides/EMAIL_VERIFICATION_GOOGLE_OAUTH_SETUP.md)** - SendGrid and Google OAuth
- **[SendGrid SMTP Setup](guides/SENDGRID_SMTP_SETUP.md)** - Email service configuration
- **[Athens Service Area Config](guides/ATHENS_SERVICE_AREA_CONFIG.md)** - Geographic configuration
- **[OAuth URLs Reference](guides/OAUTH_URLS_REFERENCE.md)** - OAuth callback URLs

---

## 🎯 Quick Start

1. **Initial Setup**: Follow [Development Setup](guides/DEVELOPMENT_SETUP.md)
2. **Run Platform**: Use [Docker Dev Commands](guides/DOCKER_DEV_COMMANDS.md)
3. **Test Login**: Use credentials from [Test Credentials](testing/TEST_CREDENTIALS.md)
4. **Security**: Configure secrets per [Security Credentials Guide](guides/SECURITY_CREDENTIALS_GUIDE.md)

---

## 🔑 Key Features

### **Authentication & Security**
- Email-based authentication with JWT tokens
- TOTP two-factor authentication (Google Authenticator compatible)
- Google OAuth integration with 2FA support
- Secure credential management with .env.dev.local

### **Job Management**
- Job posting with property details
- Bidding system for cleaners
- Photo documentation (before/after photos)
- Job lifecycle tracking (open → bid accepted → in progress → completed)

### **Payment Integration**
- Stripe payment processing
- Cleaner payout via Stripe Connect
- Payment verification before job progression
- Payment history tracking

### **Real-Time Features**
- WebSocket-based chat (job-specific rooms)
- Real-time notifications
- Redis Pub/Sub event system
- Optimistic UI updates

### **ML Recommendations**
- Hybrid scoring system (ML + business logic)
- Location-based cleaner matching
- Rating and review system
- Service area validation

---

## 🏗️ Technology Stack

**Backend**: Django 5.2, Django REST Framework, PostgreSQL, Redis, Celery  
**Frontend**: React 19.1.1, Vite, Axios, React Router  
**Real-Time**: Django Channels, WebSockets, Redis  
**Payments**: Stripe API, Stripe Connect  
**ML**: scikit-learn (cleaner recommendations)  
**Auth**: JWT (djangorestframework-simplejwt), pyotp (2FA)

---

## 📖 Additional Resources

- **[PROJECT_STATUS.md](../PROJECT_STATUS.md)** - Current implementation status
- **[DEVELOPMENT_LOG.md](../DEVELOPMENT_LOG.md)** - Development history and notes
- **[SOCIAL_PLATFORM_VISION.md](../SOCIAL_PLATFORM_VISION.md)** - Future platform vision

---

**Last Updated**: January 2025  
**Platform Version**: Production-Ready with 2FA
