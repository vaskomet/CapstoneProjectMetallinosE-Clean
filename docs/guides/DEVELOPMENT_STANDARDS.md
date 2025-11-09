# E-Clean Platform - Development Standards & Conventions

## Project Overview
E-Clean is a web application connecting clients and cleaners, built with Django REST Framework backend and React frontend. The platform features property management with interactive maps, cleaning job scheduling with calendar integration, role-based dashboards, and comprehensive authentication system.

## Technology Stack

### Backend (Django)
- **Framework**: Django 5.2 with Python 3.13
- **API**: Django REST Framework 3.15+
- **Authentication**: JWT (django-rest-framework-simplejwt) with custom email authentication backend
- **Database**: SQLite (development), PostgreSQL (production)
- **CORS**: django-cors-headers
- **Admin**: Django Admin with custom interfaces
- **Geospatial**: Coordinate fields (lat/lng) with future PostGIS support

### Frontend (React)
- **Framework**: React 19.1.1 with Vite 7.x
- **Routing**: React Router DOM 7.9.3
- **HTTP Client**: Axios 1.12.2
- **Styling**: Tailwind CSS v3.4.17 with forms plugin
- **Maps**: Leaflet 1.9.4 with react-leaflet 5.0.0 (Athens default center)
- **Calendar**: FullCalendar.js (@fullcalendar/react, daygrid, timegrid, list)
- **Notifications**: react-toastify for user feedback
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
│   │   ├── settings.py               # Django settings with JWT & CORS config
│   │   ├── urls.py                   # Main URL configuration
│   │   ├── wsgi.py                   # WSGI application
│   │   └── asgi.py                   # ASGI application
│   ├── users/                        # User management app
│   │   ├── models.py                 # Custom User model with email auth
│   │   ├── serializers.py            # User serializers with registration
│   │   ├── views.py                  # Auth views with JWT & profile management
│   │   ├── backends.py               # Custom email authentication backend
│   │   ├── urls.py                   # User URLs with profile & password endpoints
│   │   ├── admin.py                  # User admin interface
│   │   └── migrations/               # Database migrations
│   ├── properties/                   # Property management app
│   │   ├── models.py                 # Property model with geospatial fields
│   │   ├── serializers.py            # Property serializers
│   │   ├── views.py                  # Property CRUD operations
│   │   ├── urls.py                   # Property API endpoints
│   │   ├── admin.py                  # Property admin interface
│   │   └── migrations/               # Database migrations
│   ├── cleaning_jobs/                # Basic job management app
│   │   ├── models.py                 # CleaningJob model with scheduling
│   │   ├── serializers.py            # Job serializers with validation
│   │   ├── views.py                  # Job CRUD operations & listing
│   │   ├── urls.py                   # Job API endpoints
│   │   ├── admin.py                  # Job admin interface
│   │   └── migrations/               # Database migrations
│   ├── job_lifecycle/                # Enhanced workflow management app
│   │   ├── models.py                 # JobPhoto, JobAction, JobLifecycleEvent models
│   │   ├── serializers.py            # Workflow serializers with photo handling
│   │   ├── views.py                  # Workflow actions with timing validation
│   │   ├── urls.py                   # Workflow API endpoints
│   │   ├── admin.py                  # Workflow admin interface
│   │   └── migrations/               # Database migrations
└── frontend/                         # React frontend
    ├── package.json                  # Node.js dependencies with enhanced libraries
    ├── vite.config.js                # Vite configuration (port 5174)
    ├── tailwind.config.js            # Tailwind configuration with explicit classes
    ├── postcss.config.js             # PostCSS configuration
    ├── index.html                    # Entry HTML file
    ├── public/                       # Static assets
    ├── src/                          # React source code
    │   ├── main.jsx                  # React entry point
    │   ├── App.jsx                   # Main App component with enhanced routing
    │   ├── index.css                 # Global styles (Tailwind + Leaflet CSS)
    │   ├── components/               # React components
    │   │   ├── CleaningJobsPool.jsx  # Enhanced jobs with workflow integration
    │   │   ├── CompletedJobsDashboard.jsx # Job history with photo galleries
    │   │   ├── Dashboard.jsx         # Main dashboard with feature cards
    │   │   ├── JobWorkflowModal.jsx  # Workflow actions with photo requirements
    │   │   ├── Navigation.jsx        # Navigation with role-based links
    │   │   ├── PhotoUpload.jsx       # Drag & drop photo component
    │   │   ├── Profile.jsx           # User profile management
    │   │   ├── PropertiesDashboard.jsx # Property management
    │   │   ├── PropertyCard.jsx      # Property card with map integration
    │   │   ├── PropertyCreateForm.jsx # Property creation with map picker
    │   │   ├── ProtectedRoute.jsx    # Route protection component
    │   │   └── auth/                 # Authentication components
    │   │       ├── LoginForm.jsx     # Enhanced login with error handling
    │   │       └── RegisterForm.jsx  # Registration form
    │   ├── contexts/                 # React contexts
    │   │   ├── UserContext.jsx       # User state management
    │   │   └── ToastContext.jsx      # Toast notification system
    │   ├── services/                 # API services
    │   │   ├── api.js                # Axios config with interceptors
    │   │   ├── cleaningJobsAPI.js    # Job CRUD operations
    │   │   └── jobLifecycleAPI.js    # Workflow and photo upload API
    │   └── utils/                    # Utility functions
    │       └── errorHandling.js      # Error handling utilities
    └── node_modules/                 # Node.js dependencies
```

## App Architecture Principles

### Backend App Separation
The backend follows a modular app structure with clear separation of concerns:

1. **users/**: Authentication, user management, custom email backend
2. **properties/**: Property CRUD operations, geospatial data
3. **cleaning_jobs/**: Basic job management, scheduling, assignments
4. **job_lifecycle/**: Enhanced workflow, photo documentation, state transitions

### Frontend Component Architecture
The frontend follows a component-based architecture with:

1. **Pages**: Top-level route components (Dashboard, Profile)
2. **Components**: Reusable UI components (PhotoUpload, JobWorkflowModal)
3. **Contexts**: Global state management (UserContext, ToastContext)
4. **Services**: API communication layer (cleaningJobsAPI, jobLifecycleAPI)
5. **Utils**: Shared utility functions (errorHandling)

## Naming Conventions

### Backend (Django)

#### Models
- **Class Names**: PascalCase (e.g., `User`, `Property`, `CleaningJob`, `JobPhoto`)
- **Field Names**: snake_case (e.g., `first_name`, `last_name`, `phone_number`, `photo_type`)
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
- POST /api/auth/login/                   # User login (email-based)
- POST /api/auth/register/                # User registration  
- GET  /api/auth/profile/                 # Get user profile
- PATCH /api/auth/profile/                # Update user profile
- POST /api/auth/change-password/         # Change user password
- POST /api/auth/token/refresh/           # Refresh JWT token

Properties:
- GET    /api/properties/properties/      # List properties (owner-filtered)
- POST   /api/properties/properties/      # Create property (with map coordinates)
- GET    /api/properties/properties/{id}/ # Get property details
- PATCH  /api/properties/properties/{id}/ # Update property
- DELETE /api/properties/properties/{id}/ # Delete property
- GET    /api/properties/service-types/   # List service types

Cleaning Jobs:
- GET    /api/jobs/               # List cleaning jobs (role-based filtering)
- POST   /api/jobs/               # Create cleaning job (with property selection)
- GET    /api/jobs/{id}/          # Get job details
- PATCH  /api/jobs/{id}/          # Update job
- DELETE /api/jobs/{id}/          # Delete job
- PATCH  /api/jobs/{id}/claim/    # Claim job (cleaner-only endpoint)

Job Lifecycle & Workflow:
- POST   /api/lifecycle/jobs/{id}/workflow/     # Workflow actions (start, confirm, finish)
- GET    /api/lifecycle/photos/                 # List job photos
- POST   /api/lifecycle/photos/                 # Upload job photos
- GET    /api/lifecycle/actions/                # List job actions/history
- GET    /api/lifecycle/notifications/          # List user notifications
```

### Workflow API Details

#### Workflow Action Request (Multipart Form Data)
```http
POST /api/lifecycle/jobs/{id}/workflow/
Content-Type: multipart/form-data

Form Data:
- action_type: "start_job" | "confirm_job" | "finish_job"
- photo_0: [File] (required for start_job and finish_job)
- photo_0_type: "before" | "after" | "progress"
- photo_0_description: "Optional description"
- photo_1: [File] (optional additional photos)
- photo_1_type: "before" | "after" | "progress"
- photo_1_description: "Optional description"
```

#### Photo Upload Response
```json
{
  "success": true,
  "message": "Job started successfully",
  "job": {
    "id": 1,
    "status": "in_progress",
    "actual_start_time": "2025-01-02T10:30:00Z"
  },
  "photos": [
    {
      "id": 1,
      "photo_type": "before",
      "image": "/media/job_photos/1/before/20250102_103000_image.jpg",
      "description": "Before cleaning photo",
      "uploaded_at": "2025-01-02T10:30:00Z"
    }
  ]
}
```

### Request/Response Format

#### Authentication Request (Email-based)
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Authentication Response (Enhanced with user details)
```json
{
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token", 
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "client",
    "phone_number": "+1234567890"
  }
}
```

#### Property Creation Request (with coordinates)
```json
{
  "address_line1": "123 Main Street",
  "city": "Athens",
  "state": "Attica",
  "postal_code": "10001",
  "property_type": "apartment",
  "size_sqft": 850,
  "latitude": "37.97550000",
  "longitude": "23.73480000",
  "notes": "2nd floor apartment"
}
```

#### Cleaning Job Creation Request (Enhanced)
```json
{
  "property": 1,
  "scheduled_date": "2025-10-15",
  "start_time": "09:00:00",
  "end_time": "12:00:00",
  "services_requested": [1, 2],
  "estimated_duration": 180,
  "checklist": ["vacuum", "mop", "bathroom", "kitchen"],
  "notes": "Pet-friendly cleaning products only",
  "discount_applied": 10.00
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

### Property Model (Enhanced with coordinates)
```python
class Property(models.Model):
    id = AutoField(primary_key=True)
    owner = ForeignKey(User, on_delete=CASCADE, related_name='properties')
    address_line1 = CharField(max_length=255)
    address_line2 = CharField(max_length=255, blank=True)
    city = CharField(max_length=100)
    state = CharField(max_length=100)
    postal_code = CharField(max_length=20)
    country = CharField(max_length=100, default='US')
    property_type = CharField(max_length=20, choices=PROPERTY_TYPE_CHOICES)
    size_sqft = PositiveIntegerField(default=0)
    # Coordinate fields with proper precision for mapping
    latitude = DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    longitude = DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    preferences = JSONField(default=dict, blank=True)
    notes = TextField(blank=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

### CleaningJob Model (Complete implementation)
```python
class CleaningJob(models.Model):
    id = AutoField(primary_key=True)
    property = ForeignKey(Property, on_delete=CASCADE)
    client = ForeignKey(User, on_delete=CASCADE, related_name='client_jobs')
    assigned_cleaner = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True, related_name='cleaner_jobs')
    service_type = ForeignKey(ServiceType, on_delete=CASCADE)
    scheduled_date = DateField()
    start_time = TimeField()
    end_time = TimeField()
    estimated_duration = IntegerField()  # in minutes
    status = CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    # Enhanced job details
    checklist = JSONField(default=list, blank=True)
    notes = TextField(blank=True)
    discount_applied = DecimalField(max_digits=5, decimal_places=2, default=0.00)
    services_requested = ManyToManyField(ServiceType, related_name='cleaning_jobs')
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

## Authentication & Authorization

### JWT Token Structure (Enhanced)
- **Access Token**: Short-lived (60 minutes), contains user ID, email, and role
- **Refresh Token**: Long-lived (7 days), used to get new access tokens with rotation
- **Storage**: localStorage for both tokens
- **Headers**: `Authorization: Bearer <access_token>`
- **Custom Claims**: Email and role included in token for frontend use

### Authentication Backend
- **Email-based Login**: Custom authentication backend supports email instead of username
- **Password Validation**: Django validators with custom password strength requirements
- **Token Refresh**: Automatic token refresh with blacklist rotation for security

### Role-Based Permissions
- **Client**: Can create properties with map picker, book cleaning jobs, view own data, edit/delete owned properties
- **Cleaner**: Can view available jobs (pending + unassigned), claim jobs, update job status, view assigned jobs only
- **Admin**: Full access to all resources via Django admin, can manage service types and system data

### Role-Based Job Filtering
- **Clients**: See only their created jobs
- **Cleaners**: See available pending jobs (no assigned cleaner) + their assigned jobs
- **Job Claims**: PATCH `/api/jobs/{id}/claim/` endpoint for cleaners to claim available jobs

## Frontend State Management

### UserContext Structure (Complete implementation)
```javascript
// Enhanced useUser hook with full functionality
const { 
  user, 
  isAuthenticated, 
  loading, 
  error,
  login, 
  register, 
  logout, 
  updateProfile, 
  changePassword 
} = useUser();

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
  loading: boolean,
  error: string | null,
  login: (credentials) => Promise<{success: boolean, error?: string}>,
  register: (userData) => Promise<{success: boolean, error?: string}>,
  logout: () => void,
  updateProfile: (data) => Promise<{success: boolean, error?: string}>,
  changePassword: (passwordData) => Promise<{success: boolean, error?: string}>
}
```

### Enhanced Error Handling
```javascript
// Specific error messages for different authentication failures
- "Invalid email or password" (wrong password for existing account)
- "No account found with that email address" (non-existent email)
- "This field may not be blank" (empty required fields)
- "User account is disabled" (inactive account)
```

## Maps & Geolocation

### Leaflet.js Integration (Enhanced with Athens center)
- **Library**: Leaflet 1.9.4 with react-leaflet 5.0.0
- **Map Provider**: OpenStreetMap tiles with proper attribution
- **Coordinate System**: Decimal degrees (latitude, longitude)
- **Default Location**: Athens, Greece [37.9755, 23.7348] for property creation
- **Interactive Features**: Click-to-pin location picker, zoom controls, marker customization

### Property Location Handling (Updated coordinate system)
```javascript
// Property coordinates stored as DecimalField in database
{
  "latitude": "37.97550000",    // 8 decimal places precision
  "longitude": "23.73480000"    // 8 decimal places precision  
}

// Map center conversion for Leaflet (requires lat, lng array)
const getMapCenter = () => {
  if (property.latitude && property.longitude) {
    return [parseFloat(property.latitude), parseFloat(property.longitude)];
  }
  return [37.9755, 23.7348]; // Athens default center
};

// Click handler for property creation map
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat.toFixed(8), lng.toFixed(8));
    }
  });
  return null;
};
```

### Map Components (Enhanced functionality)
- **MapContainer**: Main map wrapper with Athens center, zoom controls, and scroll wheel support
- **TileLayer**: OpenStreetMap tile provider with proper attribution and zoom limits
- **Marker**: Custom circular markers with property type icons and popup information
- **Popup**: Property details including type, address, and size information
- **PropertyCreateForm**: Interactive map with click-to-place functionality for new properties

## Component Architecture

### Current Components (Complete implementation)

#### Authentication & Navigation
- **LoginForm**: Email-based authentication with enhanced error handling and validation
- **RegisterForm**: User registration with role selection and proper validation
- **Navigation**: Responsive navigation bar with role-based links (Properties, Jobs, Profile)
- **ProtectedRoute**: Route wrapper requiring authentication with redirect to login

#### Dashboard & Core Features  
- **Dashboard**: Main landing page with role-specific feature cards and quick actions
- **Profile**: Complete user profile management with personal info and password change functionality
- **CleaningJobsPool**: Advanced job management with FullCalendar integration, role-based filtering, job claiming for cleaners, and status updates
- **PropertiesDashboard**: Property management interface with grid layout, search, edit/delete capabilities
- **PropertyCard**: Individual property display with Leaflet map integration and detailed information
- **PropertyCreateForm**: Interactive property creation with Athens-centered map picker and coordinate selection

#### Enhanced Job Management
- **Calendar Integration**: FullCalendar.js with day/week/month views, job scheduling, and event interactions
- **Role-based Job Views**: Clients see their created jobs, cleaners see available + assigned jobs
- **Job Claiming**: Cleaners can claim available pending jobs with one-click functionality
- **Status Management**: Job status updates (pending → in_progress → completed) with proper UI feedback

### Component Communication Patterns
- **Props Down**: Parent components pass data and handlers to children
- **Callbacks Up**: Child components notify parents via callback functions
- **Context API**: Global user state accessed via useUser hook
- **Service Layer**: API calls abstracted into dedicated service modules

## Enhanced Architecture Patterns

### Multi-File Upload Pattern
The platform implements a robust file upload system with the following standards:

#### File Validation Standards
```javascript
// Consistent validation across all upload components
const FILE_VALIDATION = {
  maxSize: 5 * 1024 * 1024,  // 5MB maximum
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFiles: 5  // Maximum files per upload session
};

// Validation function pattern
const validateFile = (file) => {
  if (file.size > FILE_VALIDATION.maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }
  if (!FILE_VALIDATION.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP files are allowed' };
  }
  return { valid: true };
};
```

#### Drag & Drop Implementation Pattern
```javascript
// Standard drag & drop component structure
const PhotoUpload = ({ photos, onPhotosChange, maxPhotos = 5 }) => {
  const [dragOver, setDragOver] = useState(false);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => validateFile(file).valid);
    
    if (photos.length + validFiles.length > maxPhotos) {
      addToast(`Maximum ${maxPhotos} photos allowed`, 'error');
      return;
    }
    
    processFiles(validFiles);
  }, [photos, maxPhotos]);
  
  // Consistent drag state management across components
  const dragHandlers = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop
  };
};
```

#### FormData Construction Pattern
```javascript
// Standardized FormData creation for multipart uploads
const createWorkflowFormData = (action, photos) => {
  const formData = new FormData();
  formData.append('action_type', action);
  
  photos.forEach((photo, index) => {
    formData.append(`photo_${index}`, photo.image);
    formData.append(`photo_${index}_type`, photo.photo_type);
    if (photo.description) {
      formData.append(`photo_${index}_description`, photo.description);
    }
  });
  
  return formData;
};
```

### Modal Component Pattern
The platform uses a consistent modal pattern for complex interactions:

#### Base Modal Structure
```javascript
// Reusable modal component pattern
const BaseModal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-xl ${sizeClasses[size]} max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <span className="sr-only">Close</span>✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// Size classes for consistent modal sizing
const sizeClasses = {
  sm: 'w-full max-w-md',
  md: 'w-full max-w-lg',
  lg: 'w-full max-w-2xl',
  xl: 'w-full max-w-4xl'
};
```

#### Workflow Modal Implementation
```javascript
// JobWorkflowModal follows the base pattern with specific enhancements
const JobWorkflowModal = ({ job, action, isOpen, onClose, onSuccess }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Action-specific requirements
  const requiresPhotos = ['start_job', 'finish_job'].includes(action);
  const photoType = action === 'start_job' ? 'before' : 'after';
  
  // Form validation
  const canSubmit = !loading && (!requiresPhotos || photos.length > 0);
  
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={getActionTitle(action)} size="lg">
      {/* Modal content with photo upload and form validation */}
    </BaseModal>
  );
};
```

### State Management Patterns

#### Loading State Pattern
```javascript
// Consistent loading state management across components
const useAsyncOperation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const execute = useCallback(async (operation) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { loading, error, execute };
};
```

#### Form State Pattern
```javascript
// Standardized form state management
const useFormState = (initialValues, validationSchema) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      validateField(name, value);
    }
  };
  
  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, values[name]);
  };
  
  const validateField = (name, value) => {
    // Validation logic using schema
  };
  
  return { values, errors, touched, handleChange, handleBlur, isValid: Object.keys(errors).length === 0 };
};
```

### Error Handling Standards

#### Global Error Types
```javascript
// Standardized error categorization
export const ErrorTypes = {
  NETWORK_ERROR: 'Network connectivity issue',
  VALIDATION_ERROR: 'Form validation failed',
  PERMISSION_ERROR: 'Access denied',
  SERVER_ERROR: 'Internal server error',
  FILE_ERROR: 'File upload failed',
  TIMING_ERROR: 'Action not allowed at this time'
};

// Error message extraction
export const getErrorMessage = (error) => {
  if (error.response?.status === 400) {
    return error.response.data.detail || ErrorTypes.VALIDATION_ERROR;
  }
  if (error.response?.status === 403) {
    return ErrorTypes.PERMISSION_ERROR;
  }
  if (error.response?.status >= 500) {
    return ErrorTypes.SERVER_ERROR;
  }
  if (!navigator.onLine) {
    return ErrorTypes.NETWORK_ERROR;
  }
  return error.message || 'An unexpected error occurred';
};
```

#### Toast Notification Pattern
```javascript
// Consistent user feedback system
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Toast usage pattern across components
const { addToast } = useToast();

// Success operations
addToast('Job started successfully!', 'success');

// Error operations
addToast('Failed to upload photos. Please try again.', 'error');

// Warning operations
addToast('Job can be started in 15 minutes', 'warning');

// Info operations
addToast('Photos uploaded successfully', 'info');
```

### API Service Patterns

#### Service Layer Architecture
```javascript
// Base API service with common functionality
class BaseAPIService {
  constructor(baseURL) {
    this.api = axios.create({ baseURL });
    this.setupInterceptors();
  }
  
  setupInterceptors() {
    // Request interceptor for auth headers
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    // Response interceptor for token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle token refresh
          return this.handleTokenRefresh(error);
        }
        return Promise.reject(error);
      }
    );
  }
}

// Specific service implementations
class JobLifecycleService extends BaseAPIService {
  constructor() {
    super('/api/lifecycle');
  }
  
  async performWorkflowAction(jobId, action, photos = []) {
    const formData = createWorkflowFormData(action, photos);
    return this.api.post(`/jobs/${jobId}/workflow/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
}
```

#### API Response Standardization
```javascript
// Consistent API response handling
const handleAPIResponse = async (apiCall) => {
  try {
    const response = await apiCall();
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
      status: error.response?.status
    };
  }
};

// Usage pattern in components
const { loading, execute } = useAsyncOperation();

const handleSubmit = async () => {
  const result = await execute(() => 
    jobLifecycleAPI.startJob(job.id, photos)
  );
  
  if (result.success) {
    addToast('Job started successfully!', 'success');
    onSuccess();
  } else {
    addToast(result.error, 'error');
  }
};
```

### Styling Patterns

#### Tailwind CSS Consistency
```javascript
// Predefined component classes to avoid dynamic class issues
const buttonStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed'
};

const getButtonClasses = (variant, disabled, loading) => {
  const base = 'px-4 py-2 rounded-md font-medium transition-colors duration-200';
  const variant_class = disabled || loading ? buttonStyles.disabled : buttonStyles[variant];
  return `${base} ${variant_class}`;
};

// Usage in components
<button 
  className={getButtonClasses('primary', disabled, loading)}
  disabled={disabled || loading}
>
  {loading ? 'Processing...' : 'Submit'}
</button>
```

#### Responsive Design Standards
```javascript
// Consistent responsive breakpoints
const gridClasses = {
  cards: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  list: 'grid grid-cols-1 gap-4',
  dashboard: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'
};

// Responsive spacing
const spacingClasses = {
  section: 'px-4 md:px-6 lg:px-8',
  container: 'max-w-7xl mx-auto',
  card: 'p-4 md:p-6'
};
```
- **API Integration**: Centralized through services/api.js

### State Management Patterns (Enhanced)
```javascript
// Local component state for UI interactions
const [isEditing, setIsEditing] = useState(false);
const [error, setError] = useState('');
const [showCreateModal, setShowCreateModal] = useState(false);
const [selectedJob, setSelectedJob] = useState(null);

// Global auth state via useUser hook with complete functionality
const { 
  user, 
  isAuthenticated, 
  loading, 
  error, 
  login, 
  logout, 
  updateProfile, 
  changePassword 
} = useUser();

// API state management with comprehensive error handling
const [properties, setProperties] = useState([]);
const [jobs, setJobs] = useState([]);
const [serviceTypes, setServiceTypes] = useState([]);
const [loading, setLoading] = useState(true);

// FullCalendar event handling
const handleEventClick = (clickInfo) => {
  setSelectedJob(clickInfo.event.extendedProps);
  setShowJobModal(true);
};

// Map interaction state
const [mapCenter, setMapCenter] = useState([37.9755, 23.7348]); // Athens center
const [selectedCoordinates, setSelectedCoordinates] = useState(null);
```

### Enhanced API Integration Patterns
```javascript
// Comprehensive error handling with specific messages
const handleClaimJob = async (jobId) => {
  try {
    await cleaningJobsAPI.claimJob(jobId);
    toast.success('Job claimed successfully!');
    fetchJobs(); // Refresh data
  } catch (err) {
    const errorMessage = err.response?.data?.detail || 'Failed to claim job';
    toast.error('Error: ' + errorMessage);
    console.error('Claim job error:', err);
  }
};

// Role-based data filtering
const calendarEvents = jobs.map(job => ({
  id: job.id,
  title: `${job.service_type?.name || 'Cleaning'} - ${job.property?.address_line1}`,
  date: job.scheduled_date,
  backgroundColor: getEventColor(job.status),
  extendedProps: job // Full job data for modal display
}));
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

### Django Settings (Enhanced configuration)
```python
# CORS Configuration for development
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",    # React default
    "http://127.0.0.1:3000", 
    "http://localhost:5173",    # Vite default
    "http://127.0.0.1:5173",
]

# JWT Configuration with enhanced security
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Custom Authentication Backends
AUTHENTICATION_BACKENDS = [
    'users.backends.EmailBackend',  # Custom email authentication
    'django.contrib.auth.backends.ModelBackend',  # Default fallback
]

# Enhanced REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

### Package.json Dependencies (Current implementation)
```javascript
{
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1", 
    "react-router-dom": "^7.9.3",
    "axios": "^1.12.2",
    "@fullcalendar/react": "^6.1.15",
    "@fullcalendar/daygrid": "^6.1.15", 
    "@fullcalendar/timegrid": "^6.1.15",
    "@fullcalendar/list": "^6.1.15",
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0",
    "react-toastify": "^10.0.6"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.1",
    "vite": "^7.1.1",
    "tailwindcss": "^3.4.17",
    "@tailwindcss/forms": "^0.5.9",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.3",
    "eslint": "^9.18.0"
  }
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

## Quick Reference Commands (Updated)

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

# Django shell for testing
python manage.py shell

# Create service types
python manage.py shell -c "
from properties.models import ServiceType
ServiceType.objects.create(name='Basic Cleaning', description='Standard cleaning', base_price=50.00)
ServiceType.objects.create(name='Deep Cleaning', description='Comprehensive cleaning', base_price=75.00)
"
```

### Frontend
```bash
# Start development server
npm run dev

# Install dependencies
npm install

# Install new packages for current setup
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid
npm install react-leaflet leaflet react-toastify
npm install @tailwindcss/forms

# Build for production
npm run build

# Lint code
npm run lint
```

### Development Workflow (Enhanced state)
```bash
# Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend setup (separate terminal)
cd frontend
npm install
npm run dev

# Access points:
# Frontend: http://localhost:5174  # Updated port to avoid conflicts
# Backend API: http://localhost:8000/api/
# Django Admin: http://localhost:8000/admin/
# Media Files: http://localhost:8000/media/ (for uploaded photos)
```

## Current Implementation Status

### Completed Features (Phase 6 - Enhanced Architecture)
✅ **Enhanced Job Lifecycle System**
- Complete workflow state management (open_for_bids → completed)
- Photo documentation requirements for job actions
- Timing validation with 30-minute start window
- Real-time job status updates

✅ **Advanced Photo Upload System**
- Drag & drop interface with visual feedback
- File validation (5MB max, JPEG/PNG/WebP only)
- Multiple photos per workflow action
- Photo type categorization (before/after/progress)
- Secure upload path generation with timestamps

✅ **Comprehensive API Communication**
- Multipart form data handling for photo uploads
- Enhanced error handling with specific error types
- JWT authentication with automatic token refresh
- RESTful API design with proper HTTP status codes

✅ **Enhanced User Experience**
- Modal-based workflow interactions
- Toast notification system for user feedback
- Loading states and error recovery
- Real-time timing feedback for job actions

✅ **Robust Component Architecture**
- Reusable PhotoUpload component
- Centralized workflow modal pattern
- Service layer abstraction for API calls
- Consistent error handling across components

✅ **Advanced State Management**
- Global toast notification context
- Enhanced user context with profile management
- Form state management patterns
- Async operation handling utilities

### Technical Achievements
- **Code Quality**: Consistent naming conventions, comprehensive error handling
- **Performance**: Optimized image handling, lazy loading, code splitting
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Responsive Design**: Mobile-first approach, touch-friendly interfaces
- **Documentation**: Comprehensive code comments, API documentation

This document reflects the enhanced implementation as of January 2025, including the complete job lifecycle system with photo documentation, advanced workflow management, comprehensive error handling, and modern React patterns with Django REST Framework backend. All features are fully implemented, tested, and production-ready.