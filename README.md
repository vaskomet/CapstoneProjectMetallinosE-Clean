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
- **Frontend:**
  - **Framework:** React 18
  - **Styling:** Tailwind CSS
- **Database:**
  - **Development:** SQLite
  - **Production:** PostgreSQL
- **Deployment:**
  - **CI/CD:** GitHub Actions
  - **Hosting:** (To be determined - e.g., Heroku, AWS, Vercel)

### Branching Strategy
- **`main`:** This branch contains production-ready code. All deployments to the live server are made from this branch.
- **`dev`:** This is the primary integration branch. All feature branches are merged into `dev` before being promoted to `main`.
