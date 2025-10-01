# E-Clean Platform - Development Standards & Conventions

## Project Overview
E-Clean is a web application connecting clients and cleaners, built with Django REST Framework backend and React frontend.

## Technology Stack

### Backend (Django)
- **Framework**: Django 5.2 with Python 3.13
- **API**: Django REST Framework 3.15+
- **Authentication**: JWT (django-rest-framework-simplejwt)
- **Database**: SQLite (development), PostgreSQL (production)
- **CORS**: django-cors-headers
- **Admin**: Django Admin with custom interfaces

### Frontend (React)
- **Framework**: React 19.1.1 with Vite 7.x
- **Routing**: React Router DOM 7.9.3
- **HTTP Client**: Axios 1.12.2
- **Styling**: Tailwind CSS v3.4.17 with forms plugin
- **Maps**: Leaflet 1.9.4 with react-leaflet 5.0.0
- **State Management**: React Context API with useUser hook
- **Build Tool**: Vite (development server on port 5173)

## Project Structure

```
CapstoneProjectMetallinos/
├── backend/                          # Django backend
│   ├── manage.py                     # Django management script
│   ├── db.sqlite3                    # SQLite database
│   ├── requirements.txt              # Python dependencies
│   ├── e_clean_backend/              # Main Django project
│   │   ├── __init__.py
│   │   ├── settings.py               # Django settings
│   │   ├── urls.py                   # Main URL configuration
│   │   ├── wsgi.py                   # WSGI application
│   │   └── asgi.py                   # ASGI application
│   ├── users/                        # User management app
│   │   ├── models.py                 # Custom User model
│   │   ├── serializers.py            # User serializers
│   │   ├── views.py                  # Authentication views
│   │   ├── urls.py                   # User URLs
│   │   ├── admin.py                  # User admin interface
│   │   └── migrations/               # Database migrations
│   ├── properties/                   # Property management app
│   │   ├── models.py                 # Property & ServiceType models
│   │   ├── serializers.py            # Property serializers
│   │   ├── views.py                  # Property views
│   │   ├── urls.py                   # Property URLs
│   │   ├── admin.py                  # Property admin interface
│   │   └── migrations/               # Database migrations
│   └── cleaning_jobs/                # Cleaning job management app
│       ├── models.py                 # CleaningJob model
│       ├── serializers.py            # Job serializers
│       ├── views.py                  # Job views
│       ├── urls.py                   # Job URLs
│       ├── admin.py                  # Job admin interface
│       └── migrations/               # Database migrations
└── frontend/                         # React frontend
    ├── package.json                  # Node.js dependencies
    ├── vite.config.js                # Vite configuration
    ├── tailwind.config.js            # Tailwind configuration
    ├── postcss.config.js             # PostCSS configuration
    ├── index.html                    # Entry HTML file
    ├── public/                       # Static assets
    ├── src/                          # React source code
    │   ├── main.jsx                  # React entry point
    │   ├── App.jsx                   # Main App component
    │   ├── index.css                 # Global styles (Tailwind)
    │   ├── components/               # React components
    │   │   ├── Dashboard.jsx         # Main dashboard with feature cards
    │   │   ├── Navigation.jsx        # Navigation bar with auth links
    │   │   ├── Profile.jsx           # User profile management
    │   │   ├── PropertiesDashboard.jsx # Property management dashboard
    │   │   ├── PropertyCard.jsx      # Individual property card with map
    │   │   ├── ProtectedRoute.jsx    # Route protection component
    │   │   └── auth/                 # Authentication components
    │   │       ├── LoginForm.jsx     # Login form
    │   │       └── RegisterForm.jsx  # Registration form
    │   ├── contexts/                 # React contexts
    │   │   └── UserContext.jsx       # User state management with useUser hook
    │   └── services/                 # API services
    │       └── api.js                # Axios configuration & API calls
    └── node_modules/                 # Node.js dependencies
```

## Naming Conventions

### Backend (Django)

#### Models
- **Class Names**: PascalCase (e.g., `User`, `Property`, `CleaningJob`, `ServiceType`)
- **Field Names**: snake_case (e.g., `first_name`, `last_name`, `phone_number`, `user_type`)
- **Foreign Keys**: Descriptive names (e.g., `property`, `client`, `cleaner`, `service_type`)
- **Choices**: UPPER_SNAKE_CASE for constants (e.g., `ROLE_CHOICES`, `STATUS_CHOICES`)

#### URLs & Views
- **URL Patterns**: kebab-case with trailing slashes (e.g., `/api/auth/login/`, `/api/properties/`, `/api/cleaning-jobs/`)
- **View Names**: PascalCase with descriptive suffixes (e.g., `LoginView`, `RegisterView`, `PropertyListCreateView`)
- **URL Names**: snake_case (e.g., `'login'`, `'register'`, `'property_list'`)

#### Files & Directories
- **App Names**: snake_case (e.g., `users`, `properties`, `cleaning_jobs`)
- **File Names**: snake_case (e.g., `models.py`, `serializers.py`, `views.py`)

### Frontend (React)

#### Components
- **Component Names**: PascalCase (e.g., `LoginForm`, `RegisterForm`, `Dashboard`, `ProtectedRoute`, `PropertiesDashboard`, `PropertyCard`)
- **File Names**: PascalCase.jsx (e.g., `LoginForm.jsx`, `Dashboard.jsx`, `PropertyCard.jsx`)
- **Props**: camelCase (e.g., `isAuthenticated`, `userData`, `onSubmit`, `onPropertyUpdate`)

#### Functions & Variables
- **Function Names**: camelCase (e.g., `handleSubmit`, `handleChange`, `validateForm`, `getMapCenter`)
- **Variable Names**: camelCase (e.g., `formData`, `isSubmitting`, `accessToken`, `isEditing`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `TOKEN_STORAGE_KEY`)

#### CSS Classes & Maps
- **Tailwind Classes**: Standard Tailwind naming with responsive prefixes (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- **Leaflet Icons**: Custom divIcon with Tailwind styling for map markers
- **Custom Classes**: kebab-case when needed

## API Conventions

### URL Structure
```
Base URL: http://localhost:8000/api/

Authentication:
- POST /api/auth/login/                   # User login
- POST /api/auth/register/                # User registration  
- GET  /api/auth/profile/                 # Get user profile
- PATCH /api/auth/profile/                # Update user profile
- POST /api/auth/change-password/         # Change user password
- POST /api/token/refresh/                # Refresh JWT token

Properties:
- GET    /api/properties/properties/      # List properties
- POST   /api/properties/properties/      # Create property
- GET    /api/properties/properties/{id}/ # Get property details
- PATCH  /api/properties/properties/{id}/ # Update property
- DELETE /api/properties/properties/{id}/ # Delete property
- GET    /api/properties/service-types/   # List service types

Cleaning Jobs:
- GET    /api/jobs/               # List cleaning jobs
- POST   /api/jobs/               # Create cleaning job
- GET    /api/jobs/{id}/          # Get job details
- PATCH  /api/jobs/{id}/          # Update job
- DELETE /api/jobs/{id}/          # Delete job
```

### Request/Response Format

#### Authentication Request
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Authentication Response
```json
{
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "client"
  }
}
```

## Database Schema

### User Model
```python
class User(AbstractBaseUser, PermissionsMixin):
    id = AutoField(primary_key=True)
    email = EmailField(unique=True, db_index=True)
    password = CharField(max_length=128)
    first_name = CharField(max_length=50)
    last_name = CharField(max_length=50)
    phone_number = CharField(max_length=15, blank=True)
    role = CharField(max_length=10, choices=ROLE_CHOICES, default='client')
    is_active = BooleanField(default=True)
    is_staff = BooleanField(default=False)
    date_joined = DateTimeField(default=timezone.now)
```

### Property Model
```python
class Property(models.Model):
    id = AutoField(primary_key=True)
    owner = ForeignKey(User, on_delete=CASCADE, related_name='properties')
    address_line1 = CharField(max_length=255)
    address_line2 = CharField(max_length=255, blank=True)
    city = CharField(max_length=100)
    state = CharField(max_length=100)
    postal_code = CharField(max_length=20)
    property_type = CharField(max_length=50, choices=PROPERTY_TYPE_CHOICES)
    size_sqft = PositiveIntegerField(null=True, blank=True)
    notes = TextField(blank=True)
    location = PointField(null=True, blank=True)  # GeoJSON Point for maps
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

### CleaningJob Model
```python
class CleaningJob(models.Model):
    id = AutoField(primary_key=True)
    property = ForeignKey(Property, on_delete=CASCADE)
    client = ForeignKey(User, on_delete=CASCADE, related_name='client_jobs')
    cleaner = ForeignKey(User, on_delete=SET_NULL, null=True, related_name='cleaner_jobs')
    service_type = ForeignKey(ServiceType, on_delete=CASCADE)
    scheduled_date = DateTimeField()
    estimated_duration = IntegerField()  # in minutes
    price = DecimalField(max_digits=10, decimal_places=2)
    status = CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    special_instructions = TextField(blank=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

## Authentication & Authorization

### JWT Token Structure
- **Access Token**: Short-lived (15 minutes), contains user ID and role
- **Refresh Token**: Long-lived (7 days), used to get new access tokens
- **Storage**: localStorage for both tokens
- **Headers**: `Authorization: Bearer <access_token>`

### Role-Based Permissions
- **Client**: Can create properties, book cleaning jobs, view own data
- **Cleaner**: Can view assigned jobs, update job status, manage availability
- **Admin**: Full access to all resources via Django admin

## Frontend State Management

### UserContext Structure
```javascript
// Current implementation uses useUser hook
const { user, isAuthenticated, login, register, logout, updateProfile, changePassword } = useUser();

// User object structure:
{
  user: {
    id: number,
    email: string,
    first_name: string,
    last_name: string,
    phone_number: string,
    role: 'client' | 'cleaner' | 'admin'
  },
  isAuthenticated: boolean,
  login: (credentials) => Promise<{success: boolean, error?: string}>,
  register: (userData) => Promise<{success: boolean, error?: string}>,
  logout: () => void,
  updateProfile: (data) => Promise<{success: boolean, error?: string}>,
    changePassword: (passwordData) => Promise<{success: boolean, error?: string}>
}
```

## Maps & Geolocation

### Leaflet.js Integration
- **Library**: Leaflet 1.9.4 with react-leaflet 5.0.0
- **Map Provider**: OpenStreetMap tiles
- **Coordinate System**: GeoJSON format [longitude, latitude]
- **Default Location**: San Francisco [37.7749, -122.4194] for fallback

### Property Location Handling
```javascript
// Property location format (GeoJSON Point)
{
  "type": "Point",
  "coordinates": [-122.4194, 37.7749]  // [longitude, latitude]
}

// Map center conversion for Leaflet (requires lat, lng)
const getMapCenter = () => {
  if (property.location && property.location.coordinates) {
    return [property.location.coordinates[1], property.location.coordinates[0]]; // [lat, lng]
  }
  return [37.7749, -122.4194]; // Default fallback
};
```

### Map Components
- **MapContainer**: Main map wrapper with zoom and scroll controls
- **TileLayer**: OpenStreetMap tile provider with attribution
- **Marker**: Custom blue circular markers with white borders
- **Popup**: Property type and address information display

## Component Architecture

### Current Components

#### Authentication & Navigation
- **LoginForm**: User authentication with email/password
- **RegisterForm**: User registration with role selection
- **Navigation**: Responsive navigation bar with auth-based links
- **ProtectedRoute**: Route wrapper that requires authentication

#### Dashboard & Core Features
- **Dashboard**: Main landing page with role-based feature cards
- **Profile**: User profile management with password change
- **PropertiesDashboard**: Property management interface with grid layout
- **PropertyCard**: Individual property display with map integration

### Component Communication Patterns
- **Props Down**: Parent components pass data and handlers to children
- **Callbacks Up**: Child components notify parents via callback functions
- **Context API**: Global user state accessed via useUser hook
- **API Integration**: Centralized through services/api.js

### State Management Patterns
```javascript
// Local component state for UI interactions
const [isEditing, setIsEditing] = useState(false);
const [error, setError] = useState('');

// Global auth state via useUser hook
const { user, isAuthenticated, login, logout } = useUser();

// API state management with loading and error handling
const [properties, setProperties] = useState([]);
const [loading, setLoading] = useState(true);
```
}
}
```

## Development Workflow

### Backend Development
1. Create Django app: `python manage.py startapp app_name`
2. Define models in `models.py`
3. Create migrations: `python manage.py makemigrations`
4. Apply migrations: `python manage.py migrate`
5. Create serializers in `serializers.py`
6. Implement views in `views.py`
7. Configure URLs in `urls.py`
8. Register models in `admin.py`

### Frontend Development
1. Create components in appropriate directories
2. Use PascalCase for component names and files
3. Implement proper prop types and state management
4. Use useUser hook for authentication state (not direct UserContext)
5. Make API calls through services/api.js with proper endpoints
6. Apply Tailwind CSS for styling with responsive design
7. Implement proper error handling and loading states
8. For maps: Import Leaflet CSS and configure custom markers
9. Use onPropertyUpdate callbacks for state synchronization

## Configuration Files

### Django Settings (settings.py)
```python
# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",    # React default
    "http://127.0.0.1:3000",
    "http://localhost:5173",    # Vite default
    "http://127.0.0.1:5173",
]

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}
```

### Tailwind Config (tailwind.config.js)
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    // Note: @tailwindcss/typography removed - not currently used
  ],
}
```

### PostCSS Config (postcss.config.js)
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## Testing Standards

### Backend Testing
- Use Django's TestCase for model and view testing
- Test API endpoints with DRF's APITestCase
- Test authentication and permissions
- Mock external services

### Frontend Testing
- Use React Testing Library for component testing
- Test user interactions and form submissions
- Mock API calls with axios-mock-adapter
- Test authentication flows and protected routes

## Deployment Considerations

### Backend
- Use environment variables for sensitive settings
- Configure PostgreSQL for production
- Set up proper logging and monitoring
- Use gunicorn as WSGI server

### Frontend
- Build with `npm run build`
- Serve static files through CDN or web server
- Configure environment-specific API URLs
- Enable compression and caching

## Git Conventions

### Branch Naming
- `feature/feature-name`
- `bugfix/bug-description`
- `hotfix/critical-fix`

### Commit Messages
- Use conventional commits format
- Examples: `feat: add user authentication`, `fix: resolve login issue`, `docs: update API documentation`

## Security Best Practices

### Backend
- Never commit secret keys or passwords
- Use environment variables for configuration
- Implement proper input validation
- Use HTTPS in production
- Regular security updates

### Frontend
- Sanitize user inputs
- Implement proper error boundaries
- Use HTTPS for API calls
- Store tokens securely
- Implement logout on token expiration

---

## Quick Reference Commands

### Backend
```bash
# Start development server
python manage.py runserver

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Install dependencies
pip install -r requirements.txt
```

### Frontend
```bash
# Start development server
npm run dev

# Install dependencies
npm install

# Install new packages (examples)
npm install react-leaflet leaflet
npm install @tailwindcss/forms

# Build for production
npm run build

# Lint code
npm run lint
```

This document reflects the current implementation as of October 2025, including property management with Leaflet.js integration, updated React 19.1.1, and the complete authentication system with profile management. Update as new features are added or conventions change.