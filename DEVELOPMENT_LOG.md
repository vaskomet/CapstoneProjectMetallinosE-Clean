# E-Clean Platform - Development Log

This document tracks the development process of the E-Clean Platform, a web application connecting clients and cleaners.

---
source ./.venv/bin/activate
## Phase 1: Project Initialization & Setup

**Date:** 2025-10-01

### 1.1: Django Backend Initialization
- **Description:** Set up the initial Django project structure for the backend.
- **Details:**
    - Created a `backend` directory.
    - Initialized a Django project named `e_clean_backend`.
    - Created three Django apps: `users`, `properties`, and `cleaning_jobs`.
    - Configured `settings.py` to include the new apps, `rest_framework`, and `corsheaders`.
    - Set up a placeholder for JWT authentication in `settings.py`.
    - Configured `CORS_ALLOWED_ORIGINS` to allow requests from `localhost:3000`.
    - Created a `requirements.txt` file with initial dependencies: `Django`, `djangorestframework`, `django-cors-headers`.
    - Created a `.gitignore` file.

### 1.2: Git Repository Setup
- **Description:** Initialized a Git repository and linked it to a remote GitHub repository.
- **Details:**
    - Initialized a local Git repository in the project root.
    - Added the remote origin: `https://github.com/vaskomet/CapstoneProjectMetallinosE-Clean.git`.
    - Created a `README.md` with a project overview, tech stack, and branching strategy.
    - Made the initial commit and pushed it to the `main` branch on GitHub.

---

## Phase 2: User Authentication

**Date:** 2025-10-01

### 2.1: Custom User Model
- **Description:** Implemented a custom user model to support email-based authentication and user roles.
- **Details:**
    - Created a `User` model in `backend/users/models.py` extending `AbstractBaseUser` and `PermissionsMixin`.
    - Set `email` as the `USERNAME_FIELD`.
    - Added fields for `role`, `phone_number`, `profile_picture`, etc.
    - Implemented a `CustomUserManager` to handle user creation.
    - Committed and pushed changes to GitHub.

### 2.2: User Serializers
- **Description:** Created DRF serializers for the custom user model.
- **Details:**
    - Created `backend/users/serializers.py`.
    - Implemented `UserSerializer` for read-only user data representation.
    - Implemented `UserRegistrationSerializer` to handle new user registration, including password validation and hashing.
    - Committed and pushed changes to GitHub.

### 2.3: Authentication Views
- **Description:** Implemented API views for user registration and login.
- **Details:**
    - Added `djangorestframework-simplejwt` to `requirements.txt` and installed it.
    - Created `backend/users/views.py`.
    - Implemented `RegisterView` (`generics.CreateAPIView`) for user registration.
    - Implemented `LoginView` (extending `TokenObtainPairView`) for user login, with a custom serializer to include user details in the token response.
    - Committed and pushed changes to GitHub.

### 2.4: URL Configuration
- **Description:** Configured URL routing for the authentication API.
- **Details:**
    - Created `backend/users/urls.py` to define endpoints for `register` and `login`.
    - Updated the root `backend/e_clean_backend/urls.py` to include the `users.urls` under the `api/auth/` namespace.
    - Added the `api/token/refresh/` endpoint for JWT token refreshing.

### 2.5: Property and Service Type Models
- **Description:** Implemented models for property management and service standardization with geospatial support.
- **Details:**
    - Created `Property` model in `backend/properties/models.py` with geospatial support using GeoDjango.
    - Added fields for address, location (PointField), property type, size, preferences, and notes.
    - Implemented `ServiceType` model for standardizing cleaning services.
    - Configured `django.contrib.gis` in `settings.py` for geospatial functionality.
    - Added database indexes including GIST index on location field for optimal spatial queries.

### 2.6: Property and Service Type Serializers
- **Description:** Created DRF serializers for Property and ServiceType models with geospatial API support.
- **Details:**
    - Created `backend/properties/serializers.py`.
    - Implemented `PropertySerializer` with GeoJSON support for location field, compatible with Leaflet.js mapping.
    - Added location coordinate validation to ensure valid latitude/longitude ranges.
    - Implemented `ServiceTypeSerializer` for service standardization API endpoints.
    - Configured read-only fields and depth settings for proper API data representation.

### 2.7: Property and Service Type API Views
- **Description:** Implemented DRF API views for Property and ServiceType CRUD operations with role-based permissions.
- **Details:**
    - Created `backend/properties/views.py`.
    - Implemented `PropertyListCreateView` for listing all properties and creating new ones with ownership assignment.
    - Implemented `PropertyRetrieveUpdateDestroyView` with ownership-based permissions for property management.
    - Implemented `ServiceTypeListCreateView` for service type listing and admin creation.
    - Added proper authentication requirements and permission checks for all operations.
    - Integrated geospatial data support for location-based property management.

---

## Phase 3: Bug Fixing and Refinements

**Date:** 2025-10-01

### 3.1: Server Run Error Resolution
- **Description:** Addressed critical errors that prevented the Django development server from running.
- **Details:**
    - **Pillow Installation:** Installed the `Pillow` library to support `ImageField` in the `User` model and added it to `requirements.txt`.
    - **Custom User Model Configuration:** Set `AUTH_USER_MODEL = 'users.User'` in `settings.py` to correctly point to the custom user model.
    - **Reverse Accessor Clashes:** Resolved `(fields.E304)` errors by adding `related_name` attributes to the `groups` and `user_permissions` fields in the custom `User` model. This disambiguates the reverse relationships from the built-in `auth.User` model.
    - **Database Migrations:** Created and applied the initial database migration for the `users` app to resolve a `ValueError: Dependency on app with no migrations: users` error.
    - **UniqueValidator Import Fix:** Fixed an `AttributeError` in `users/serializers.py` by importing `UniqueValidator` from `rest_framework.validators` instead of accessing it through `rest_framework.serializers`.
