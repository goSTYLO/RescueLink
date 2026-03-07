# RescueLink Backend API Documentation

## Base URL

```
http://localhost:3000/api
```

## Latest Integration Notes (Mobile + Backend)

- Mobile incident detail flow is now unified on a single screen that uses `GET /api/incidents/:id/with-ai` as its primary data source.
- AI confidence values may appear under different keys depending on endpoint/path:
  - `ai_classification.confidence` (create response path)
  - `ai_classification.confidence_score` (stored classification path)
  - `incident.primary_confidence` (incident-level fallback)
- Incident evidence download endpoints used by mobile:
  - `GET /api/incidents/:id/audio`
  - `GET /api/incidents/:id/media/:index`
- Notification ownership behavior for role `user`:
  - list endpoint always returns only the authenticated user's notifications (even if `user_id` query is provided)
  - detail endpoint returns `403` when accessing another user's notification

## Authentication

All API endpoints **except** authentication endpoints require JWT authentication. Include a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

To obtain a JWT token, use the `/api/auth/login` or `/api/auth/register` endpoints.

**Authentication Error Responses:**

- `401 Unauthorized` - Missing authorization header
- `401 Unauthorized` - Invalid authorization format (must be "Bearer <token>")
- `401 Unauthorized` - Invalid or expired token

---

## Input Validation

All API endpoints include comprehensive input validation to prevent SQL injection and ensure data integrity:

**Validation Rules:**

- **Integers** (IDs, pagination): Must be positive integers
- **Phone numbers**: Max 20 characters, accepts digits, +, spaces, hyphens, parentheses
- **Email**: Must be valid email format, max 255 characters
- **Names** (first/last): 1-100 characters
- **Passwords**: 8-128 characters, must contain at least one letter and one number
- **Coordinates**: Latitude must be between -90 and 90 degrees, Longitude must be between -180 and 180 degrees
- **Strings** (general): Length limits based on database schema (typically 50-500 characters)
- **Pagination**: `limit` capped at 100, `offset` must be non-negative

**Validation Error Response:**
All validation errors return `400 Bad Request` with a descriptive error message:

```json
{
  "error": "firstName must be at least 1 characters",
  "message": "Invalid phone number format"
}
```

**Security:**

- All database queries use parameterized statements to prevent SQL injection
- Input sanitization removes dangerous control characters
- Type checking ensures data matches expected formats
- Length constraints prevent buffer overflow attacks
- **Password Security**: All passwords are hashed using bcrypt with configurable salt rounds (default: 10) before storage. Passwords are never stored in plain text.
- **Encryption Utilities**: AES-256-GCM encryption utilities are available for encrypting sensitive data at rest (e.g., API keys, tokens). Requires `ENCRYPTION_KEY` environment variable.

---

## Role-Based Access Control (RBAC)

RescueLink implements a three-tier role-based access control system to enforce fine-grained authorization across all endpoints.

### User Roles

| Role | Description | Created By | Use Cases |
|------|-------------|-----------|-----------|
| **user** | Mobile app reporters/citizens | Self-registration via phone | Report incidents, view own reports |
| **dispatcher** | Web app administrators | Admin user creation | Manage incidents, dispatches, responders, audit logs |
| **admin** | System administrators | Admin user creation | User management, system configuration, full access |

### Permission Matrix

| Resource | user | dispatcher | admin |
|----------|------|-----------|-------|
| **Incidents** | Create own; Read own; Update own; Delete own | Create; Read all; Update all; Delete all | All (manage) |
| **Dispatches** | None | Create; Read all; Update all; Delete all | All (manage) |
| **Responders** | None | Create; Read all; Update all; Delete all | All (manage) |
| **Notifications** | Create own; Read own | Create; Read all; Update all | All (manage) |
| **Audit Logs** | None | Read own logs | Read all logs |
| **Users** | None | None | Create; Read; Update roles; Deactivate; Delete |
| **Settings** | None | None | Full access |

### RBAC Enforcement

**Authorization Errors:**

- `401 Unauthorized` - User is not authenticated (missing or invalid token)
- `403 Forbidden` - User is authenticated but lacks required role or permission
  - Example: Regular user trying to access dispatcher endpoints
  - Example: User trying to access another user's incident

**Ownership Checks:**

- **Regular users (role: user)** can only access resources they created
  - Cannot view other users' incidents
  - Cannot modify other users' notifications
  - Cannot download other users' audio/media files
- **Dispatchers and Admins** have unrestricted access to all resources of that type
  - Can view all incidents regardless of creator
  - Can manage all dispatches and responders
  - Can access all users' data for administrative purposes

**Example: Accessing Incidents**

```
User 1 (role: user) requesting GET /api/incidents/5:
  - If incident 5 was created by User 1: ✅ Allowed (200)
  - If incident 5 was created by User 2: ❌ Forbidden (403)
  - If not authenticated: ❌ Unauthorized (401)

Dispatcher 1 (role: dispatcher) requesting GET /api/incidents/5:
  - Regardless of who created it: ✅ Allowed (200)

Admin 1 (role: admin) requesting GET /api/incidents/5:
  - Regardless of who created it: ✅ Allowed (200)
```

### Token Contents

JWT tokens include the user's role, which is validated by the RBAC middleware:

```json
{
  "user_id": 123,
  "email": "user@example.com",
  "role": "user",  // or "dispatcher" or "admin"
  "iat": 1645000000,
  "exp": 1645604800
}
```

### Admin-Only Endpoints

All endpoints under `/api/admin/*` require the `admin` role:

- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - View specific user
- `POST /api/admin/users` - Create user with role assignment
- `PUT /api/admin/users/:id/role` - Update user role
- `PUT /api/admin/users/:id/deactivate` - Deactivate user account
- `DELETE /api/admin/users/:id` - Permanently delete user
- `GET /api/admin/stats` - View system statistics

---

## Authentication API

---

## Incident Upload API (AI + Scan)

### Create Incident with Audio + Media

**POST** `/api/incidents/with-audio`

Create a new incident with required audio and optional media files. Endpoint performs:
- upload size/type validation,
- quick security scan (signature + blocked binary/script detection),
- optional compression (images/videos),
- asynchronous deep-scan workflow with fail-open support when configured.

**Auth Required:** Yes (`user`, `dispatcher`, `admin`)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `latitude` (required)
- `longitude` (required)
- `description` (optional)
- `audio` (required; single file)
- `media` (optional; up to 5 files)

**Response:** `201 Created`

```json
{
  "success": true,
  "message": "Incident reported successfully with AI classification",
  "incident": {
    "report_id": 123,
    "scan_status": "pending"
  },
  "ai_classification": {
    "primary_type": "Medical",
    "low_confidence_flag": false
  },
  "security_scan": {
    "quick_scan": {
      "status": "clean",
      "findings": []
    },
    "deep_scan": {
      "status": "ready",
      "engine": "stub",
      "queued": true,
      "job_id": "deep-scan-123-1700000000000"
    },
    "fail_open_flagged": false
  }
}
```

**Common Scan States**
- `clean`: latest scan completed without threat
- `pending`: queued for deep scan
- `unscanned`: scanner unavailable but upload accepted (fail-open)
- `quarantined`: threat found and files moved to quarantine storage
- `error`: scanner processing failure

**Security Error Responses**
- `400 Bad Request`: quick scan blocked suspicious file
- `503 Service Unavailable`: scanner unavailable and fail-open disabled

### Register

**POST** `/api/auth/register`

Register a new user with phone number, password, and optional email. Does not require authentication.

**Request Body:**

```json
{
  "phone": "+1234567890", // required
  "firstName": "John", // required
  "lastName": "Doe", // required
  "password": "SecurePass123", // required
  "email": "john@example.com", // optional
  "address": "123 Main St, City, State 12345" // optional
}
```

**Response:** `201 Created`

```json
{
  "user": {
    "user_id": 1,
    "phone": "+1234567890",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields (phone, firstName, lastName, or password) or validation errors
- `409 Conflict` - User with this phone already exists
- `500 Internal Server Error` - Registration failed

**Validation:**

- `phone`: Max 20 characters, valid phone format
- `firstName`: 1-100 characters
- `lastName`: 1-100 characters
- `password`: 8-128 characters, must contain at least one letter and one number
- `email` (optional): Valid email format, max 255 characters
- `address` (optional): Max 255 characters

**Notes:**

- The user is created with `phone_verified: false` and `role: 'user'`
- Password is hashed using bcrypt before storage
- JWT token is valid for 7 days
- JWT payload contains user_id, phone, and role

---

### Login

**POST** `/api/auth/login`

Login with phone number and password. Does not require authentication.

**Request Body:**

```json
{
  "phone": "+1234567890", // required
  "password": "SecurePass123" // required
}
```

**Response:** `200 OK`

```json
{
  "user": {
    "user_id": 1,
    "phone": "+1234567890",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields (phone or password) or validation errors
- `401 Unauthorized` - Invalid credentials (invalid phone, password, or user has no password set)
- `500 Internal Server Error` - Login failed

**Validation:**

- `phone`: Max 20 characters, valid phone format
- `password`: Must match the user's stored password hash

**Notes:**

- Password is verified against the bcrypt hash stored in the database
- JWT token is valid for 7 days
- Token payload contains user_id, phone, and role

---

### Onboard Phone

**POST** `/api/auth/onboard-phone`

Verify phone number using Firebase and update user's phone verification status. Does not require authentication.

**Flow:**

1. Client performs Firebase phone verification using Firebase client SDK
2. Client obtains a Firebase ID token after successful verification
3. Client sends the ID token (and optionally a password) to this endpoint
4. Server verifies the token with Firebase Admin SDK and updates the user's `phone_verified` status to `true`
5. If password is provided, it is validated, hashed, and stored

**Request Body:**

```json
{
  "idToken": "firebase_id_token_here", // required
  "password": "SecurePass123" // optional
}
```

**Response:** `200 OK`

```json
{
  "user": {
    "user_id": 1,
    "phone": "+1234567890",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request` - Missing idToken, ID token does not contain a phone number, or validation errors (including password validation if provided)
- `404 Not Found` - User not found. Please register first.
- `500 Internal Server Error` - Phone onboarding failed

**Validation:**

- `idToken`: 1-2048 characters (required)
- `password`: 8-128 characters, must contain at least one letter and one number (optional, but validated if provided)

**Notes:**

- User must be registered first before calling this endpoint
- Updates `phone_verified` to `true`
- If password is provided, it is hashed using bcrypt before storage
- Returns a new JWT token valid for 7 days
- Requires Firebase Admin SDK configuration
- Updates `phone_verified` to `true`
- Returns a new JWT token valid for 7 days
- Requires Firebase Admin SDK configuration

---

## Responders API

### Create Responder

**POST** `/api/responders`

Create a new responder record.

**Required Role:** `dispatcher`, `admin`

**Request Body:**

```json
{
  "name": "John Doe", // required
  "organization": "Fire Department", // optional
  "contact_number": "+1234567890", // optional
  "availability_status": "available" // optional
}
```

**Response:** `201 Created`

```json
{
  "responder_id": 1,
  "name": "John Doe",
  "organization": "Fire Department",
  "contact_number": "+1234567890",
  "availability_status": "available"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required field (name) or validation errors
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User role does not have permission (only dispatcher and admin can create responders)
- `500 Internal Server Error` - Server error

**Validation:**

- `name`: 1-150 characters (required)
- `organization`: Max 150 characters (optional)
- `contact_number`: Max 20 characters (optional)
- `availability_status`: Max 50 characters (optional)

---

### Get All Responders

**GET** `/api/responders`

Retrieve a paginated list of responders with optional filtering.

**Query Parameters:**

- `limit` (integer, optional) - Number of records to return (default: 20, max: 100)
- `offset` (integer, optional) - Number of records to skip (default: 0)
- `organization` (string, optional) - Filter by organization
- `availability_status` (string, optional) - Filter by availability status

**Example:**

```
GET /api/responders?limit=10&offset=0&availability_status=available
```

**Response:** `200 OK`

```json
[
  {
    "responder_id": 1,
    "name": "John Doe",
    "organization": "Fire Department",
    "contact_number": "+1234567890",
    "availability_status": "available"
  },
  {
    "responder_id": 2,
    "name": "Jane Smith",
    "organization": "Police Department",
    "contact_number": "+0987654321",
    "availability_status": "busy"
  }
]
```

**Error Responses:**

- `500 Internal Server Error` - Server error

---

### Get Responder by ID

**GET** `/api/responders/:id`

Retrieve a specific responder by ID.

**Parameters:**

- `id` (integer) - Responder ID

**Response:** `200 OK`

```json
{
  "responder_id": 1,
  "name": "John Doe",
  "organization": "Fire Department",
  "contact_number": "+1234567890",
  "availability_status": "available"
}
```

**Error Responses:**

- `404 Not Found` - Responder not found
- `500 Internal Server Error` - Server error

---

### Update Responder

**PUT** `/api/responders/:id`

Update a responder record. **Full update required** - all fields must be provided.

**Parameters:**

- `id` (integer) - Responder ID

**Request Body:**

```json
{
  "name": "John Doe", // required
  "organization": "Fire Department", // required (can be null)
  "contact_number": "+1234567890", // required (can be null)
  "availability_status": "busy" // required (can be null)
}
```

**Response:** `200 OK`

```json
{
  "responder_id": 1,
  "name": "John Doe",
  "organization": "Fire Department",
  "contact_number": "+1234567890",
  "availability_status": "busy"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields for full update or validation errors
- `404 Not Found` - Responder not found
- `500 Internal Server Error` - Server error

**Validation:**

- `id`: Must be a positive integer
- `name`: 1-150 characters (required)
- `organization`: Max 150 characters (required, can be null)
- `contact_number`: Max 20 characters (required, can be null)
- `availability_status`: Max 50 characters (required, can be null)

---

### Delete Responder

**DELETE** `/api/responders/:id`

Delete a responder record.

**Parameters:**

- `id` (integer) - Responder ID

**Response:** `200 OK`

```json
{
  "message": "Responder deleted successfully",
  "responder": {
    "responder_id": 1,
    "name": "John Doe",
    "organization": "Fire Department",
    "contact_number": "+1234567890",
    "availability_status": "available"
  }
}
```

**Error Responses:**

- `404 Not Found` - Responder not found
- `500 Internal Server Error` - Server error

---

## Dispatches API

### Create Dispatch

**POST** `/api/dispatches`

Create a new dispatch record. Validates that both the incident report and responder exist.

**Required Role:** `dispatcher`, `admin`

**Request Body:**

```json
{
  "report_id": 1, // required
  "responder_id": 1, // required
  "response_status": "en_route" // optional
}
```

**Response:** `201 Created`

```json
{
  "dispatch_id": 1,
  "report_id": 1,
  "responder_id": 1,
  "dispatched_at": "2026-01-20T10:30:00.000Z",
  "response_status": "en_route"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields (report_id or responder_id) or validation errors
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User role does not have permission (only dispatcher and admin can create dispatches)
- `404 Not Found` - Incident report not found or Responder not found
- `500 Internal Server Error` - Server error

**Validation:**

- `report_id`: Must be a positive integer (required)
- `responder_id`: Must be a positive integer (required)
---

### Get All Dispatches

**GET** `/api/dispatches`

Retrieve a paginated list of dispatches with optional filtering.

**Required Role:** `dispatcher`, `admin`

**Query Parameters:**

- `limit` (integer, optional) - Number of records to return (default: 20, max: 100)
- `offset` (integer, optional) - Number of records to skip (default: 0)
- `report_id` (integer, optional) - Filter by incident report ID
- `responder_id` (integer, optional) - Filter by responder ID
- `response_status` (string, optional) - Filter by response status

**Example:**

```
GET /api/dispatches?limit=10&offset=0&response_status=en_route
```

**Response:** `200 OK`

```json
[
  {
    "dispatch_id": 1,
    "report_id": 1,
    "responder_id": 1,
    "dispatched_at": "2026-01-20T10:30:00.000Z",
    "response_status": "en_route"
  },
  {
    "dispatch_id": 2,
    "report_id": 2,
    "responder_id": 2,
    "dispatched_at": "2026-01-20T11:00:00.000Z",
    "response_status": "arrived"
  }
]
```

**Error Responses:**

- `500 Internal Server Error` - Server error

---

### Get Dispatch by ID

**GET** `/api/dispatches/:id`

Retrieve a specific dispatch by ID.

**Parameters:**

- `id` (integer) - Dispatch ID

**Response:** `200 OK`

```json
{
  "dispatch_id": 1,
  "report_id": 1,
  "responder_id": 1,
  "dispatched_at": "2026-01-20T10:30:00.000Z",
  "response_status": "en_route"
}
```

**Error Responses:**

- `404 Not Found` - Dispatch not found
- `500 Internal Server Error` - Server error

---

### Update Dispatch

**PUT** `/api/dispatches/:id`

Update a dispatch record. **Full update required** - all fields must be provided. Validates that both the incident report and responder exist.

**Parameters:**

- `id` (integer) - Dispatch ID

**Request Body:**

```json
{
  "report_id": 1, // required
  "responder_id": 1, // required
  "response_status": "arrived" // required (can be null)
}
```

**Response:** `200 OK`

```json
{
  "dispatch_id": 1,
  "report_id": 1,
  "responder_id": 1,
  "dispatched_at": "2026-01-20T10:30:00.000Z",
  "response_status": "arrived"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields for full update or validation errors
- `404 Not Found` - Dispatch not found, Incident report not found, or Responder not found
- `500 Internal Server Error` - Server error

**Validation:**

- `id`: Must be a positive integer
- `report_id`: Must be a positive integer (required)
- `responder_id`: Must be a positive integer (required)
- `response_status`: Max 50 characters (required, can be null)

---

### Delete Dispatch

**DELETE** `/api/dispatches/:id`

Delete a dispatch record.

**Parameters:**

- `id` (integer) - Dispatch ID

**Response:** `200 OK`

```json
{
  "message": "Dispatch deleted successfully",
  "dispatch": {
    "dispatch_id": 1,
    "report_id": 1,
    "responder_id": 1,
    "dispatched_at": "2026-01-20T10:30:00.000Z",
    "response_status": "arrived"
  }
}
```

**Error Responses:**

- `404 Not Found` - Dispatch not found
- `500 Internal Server Error` - Server error

---

## Notifications API

### Create Notification

**POST** `/api/notifications`

Create a new notification record. Validates that the user exists and optionally validates the incident report.

**Request Body:**

```json
{
  "user_id": 1, // required
  "report_id": 1, // optional
  "message": "Emergency dispatch in your area", // required
  "sent_via": "SMS" // optional
}
```

**Response:** `201 Created`

```json
{
  "notification_id": 1,
  "user_id": 1,
  "report_id": 1,
  "message": "Emergency dispatch in your area",
  "sent_via": "SMS",
  "sent_at": "2026-01-20T10:30:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields (user_id or message) or validation errors
- `404 Not Found` - User not found or Incident report not found
- `500 Internal Server Error` - Server error

**Validation:**

- `user_id`: Must be a positive integer (required)
- `report_id`: Must be a positive integer if provided (optional)
- `message`: 1-500 characters (required)
- `sent_via`: Max 50 characters (optional)

---

### Get All Notifications

**GET** `/api/notifications`

Retrieve a paginated list of notifications with optional filtering.

**Role-specific behavior:**

- `user`: always scoped to authenticated user's notifications
- `dispatcher`, `admin`: can query across users (including `user_id` filter)

**Query Parameters:**

- `limit` (integer, optional) - Number of records to return (default: 20, max: 100)
- `offset` (integer, optional) - Number of records to skip (default: 0)
- `user_id` (integer, optional) - Filter by user ID
- `report_id` (integer, optional) - Filter by incident report ID
- `sent_via` (string, optional) - Filter by notification channel

**Example:**

```
GET /api/notifications?limit=10&offset=0&user_id=1&sent_via=SMS
```

**Response:** `200 OK`

```json
[
  {
    "notification_id": 1,
    "user_id": 1,
    "report_id": 1,
    "message": "Emergency dispatch in your area",
    "sent_via": "SMS",
    "sent_at": "2026-01-20T10:30:00.000Z"
  },
  {
    "notification_id": 2,
    "user_id": 1,
    "report_id": 2,
    "message": "Update on incident #2",
    "sent_via": "Email",
    "sent_at": "2026-01-20T11:00:00.000Z"
  }
]
```

**Error Responses:**

- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Accessing notifications outside user ownership (regular users)
- `500 Internal Server Error` - Server error

---

### Get Notification by ID

**GET** `/api/notifications/:id`

Retrieve a specific notification by ID.

**Parameters:**

- `id` (integer) - Notification ID

**Response:** `200 OK`

```json
{
  "notification_id": 1,
  "user_id": 1,
  "report_id": 1,
  "message": "Emergency dispatch in your area",
  "sent_via": "SMS",
  "sent_at": "2026-01-20T10:30:00.000Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User cannot access this notification (ownership violation)
- `404 Not Found` - Notification not found
- `500 Internal Server Error` - Server error

---

### Get Incident by ID with AI

**GET** `/api/incidents/:id/with-ai`

Retrieve incident detail plus latest AI classification (if available).

**Required Role:** `user`, `dispatcher`, `admin`

**Ownership Rules:**

- Regular users can only view incidents they created
- Dispatchers and admins can view any incident

**Parameters:**

- `id` (integer) - Incident report ID

**Response:** `200 OK`

```json
{
  "incident": {
    "report_id": 123,
    "user_id": 9,
    "incident_type": "medical",
    "severity_level": "high",
    "primary_confidence": 0.88,
    "audio_path": "uploads/incidents/incident_123_audio.wav",
    "media_paths": [
      "uploads/incidents/incident_123_photo_1.jpg"
    ],
    "status": "in_progress"
  },
  "ai_classification": {
    "classification_id": 55,
    "report_id": 123,
    "predicted_type": "medical",
    "predicted_severity": "high",
    "confidence_score": 0.88,
    "secondary_predicted_type": "disaster",
    "secondary_confidence_score": 0.41,
    "low_confidence_flag": false
  }
}
```

**Error Responses:**

- `400 Bad Request` - Invalid incident ID format
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User cannot access this incident (ownership violation)
- `404 Not Found` - Incident not found
- `500 Internal Server Error` - Server error

---

### Download Incident Audio

**GET** `/api/incidents/:id/audio`

Download the incident's audio evidence file.

**Required Role:** `user`, `dispatcher`, `admin`

**Ownership Rules:**

- Regular users can only download from incidents they created
- Dispatchers and admins can download from any incident

**Parameters:**

- `id` (integer) - Incident report ID

**Response:** `200 OK` (binary file stream)

**Error Responses:**

- `400 Bad Request` - Invalid incident ID format
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User cannot access this incident (ownership violation)
- `404 Not Found` - Incident or audio file not found
- `500 Internal Server Error` - Server error

---

### Download Incident Media by Index

**GET** `/api/incidents/:id/media/:index`

Download a specific incident media file by index from `media_paths`.

**Required Role:** `user`, `dispatcher`, `admin`

**Ownership Rules:**

- Regular users can only download from incidents they created
- Dispatchers and admins can download from any incident

**Parameters:**

- `id` (integer) - Incident report ID
- `index` (integer) - Zero-based media index

**Response:** `200 OK` (binary file stream)

**Error Responses:**

- `400 Bad Request` - Invalid incident ID or media index
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User cannot access this incident (ownership violation)
- `404 Not Found` - Incident, media index, or media file not found
- `500 Internal Server Error` - Server error

---

### Update Notification

**PUT** `/api/notifications/:id`

Update a notification record. **Full update required** - all fields must be provided. Validates that the user exists and optionally validates the incident report.

**Parameters:**

- `id` (integer) - Notification ID

**Request Body:**

```json
{
  "user_id": 1, // required
  "report_id": 1, // required (can be null)
  "message": "Emergency dispatch in your area", // required
  "sent_via": "Email" // required (can be null)
}
```

**Response:** `200 OK`

```json
{
  "notification_id": 1,
  "user_id": 1,
  "report_id": 1,
  "message": "Emergency dispatch in your area",
  "sent_via": "Email",
  "sent_at": "2026-01-20T10:30:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields for full update or validation errors
- `404 Not Found` - Notification not found, User not found, or Incident report not found
- `500 Internal Server Error` - Server error

**Validation:**

- `id`: Must be a positive integer
- `user_id`: Must be a positive integer (required)
- `report_id`: Must be a positive integer if provided (required, can be null)
- `message`: 1-500 characters (required)
- `sent_via`: Max 50 characters (required, can be null)

---

### Delete Notification

**DELETE** `/api/notifications/:id`

Delete a notification record.

**Parameters:**

- `id` (integer) - Notification ID

**Response:** `200 OK`

```json
{
  "message": "Notification deleted successfully",
  "notification": {
    "notification_id": 1,
    "user_id": 1,
    "report_id": 1,
    "message": "Emergency dispatch in your area",
    "sent_via": "SMS",
    "sent_at": "2026-01-20T10:30:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Invalid notification ID format
- `404 Not Found` - Notification not found
- `500 Internal Server Error` - Server error

**Validation:**

- `id`: Must be a positive integer

---

## Location API

### Check Location

**POST** `/api/location/check`

Check if a given coordinate point (latitude, longitude) is within Dagupan city boundaries. Does not require authentication.

**Request Body:**

```json
{
  "latitude": 16.043021, // required, must be between -90 and 90
  "longitude": 120.3337627 // required, must be between -180 and 180
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "isInDagupan": true,
  "coordinates": {
    "latitude": 16.043021,
    "longitude": 120.3337627
  },
  "message": "The coordinates are within Dagupan city boundaries"
}
```

**Example Response (Outside Dagupan):**

```json
{
  "success": true,
  "isInDagupan": false,
  "coordinates": {
    "latitude": 14.6042,
    "longitude": 120.9822
  },
  "message": "The coordinates are outside Dagupan city boundaries"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields (latitude or longitude) or validation errors
- `500 Internal Server Error` - Failed to check location

**Validation:**

- `latitude`: Must be a valid number between -90 and 90 degrees
- `longitude`: Must be a valid number between -180 and 180 degrees

**Notes:**

- Uses the ray casting algorithm to determine if a point is inside the polygon
- Polygon boundaries are loaded from the Dagupan GeoJSON file
- The endpoint is public and does not require authentication
- Coordinates are validated before processing

---

## Incidents API

### Create Emergency Incident

**POST** `/api/incidents/emergency`

Create an emergency incident report with only coordinates. This endpoint is optimized for speed and automatically sets high priority. Does not trigger AI classification. Requires authentication.

**Required Role:** `user`, `dispatcher`, `admin`

**Request Body:**

```json
{
  "latitude": 16.043021, // required, must be between -90 and 90
  "longitude": 120.3337627 // required, must be between -180 and 180
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "message": "Emergency incident reported successfully",
  "incident": {
    "report_id": 1,
    "user_id": 1,
    "incident_type": null,
    "severity_level": "high",
    "description": null,
    "latitude": 16.043021,
    "longitude": 120.3337627,
    "media_url": null,
    "status": "pending",
    "created_at": "2026-01-20T10:30:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields (latitude or longitude) or validation errors
- `401 Unauthorized` - Missing or invalid authentication token
- `500 Internal Server Error` - Failed to create emergency incident

**Validation:**

- `latitude`: Must be a valid number between -90 and 90 degrees
- `longitude`: Must be a valid number between -180 and 180 degrees

**Notes:**

- Automatically sets `severity_level` to "high" for emergency priority
- `incident_type` is set to `null` (no classification for emergency reports)
- `user_id` is automatically extracted from JWT authentication token
- Does NOT trigger AI classification (skips ai_classifications table)
- Designed for fast reporting in time-critical situations
---

### Get Incident by ID

**GET** `/api/incidents/:id`

Retrieve a specific incident report by ID. Requires authentication.

**Required Role:** `user`, `dispatcher`, `admin`

**Ownership Rules:**
- Regular users can only view incidents they created
- Dispatchers and admins can view any incident

**Parameters:**

- `id` (integer) - Incident report ID

**Response:** `200 OK`

```json
{
  "report_id": 1,
  "user_id": 1,
  "incident_type": null,
  "severity_level": "high",
  "description": null,
  "latitude": 16.043021,
  "longitude": 120.3337627,
  "media_url": null,
  "status": "pending",
  "created_at": "2026-01-20T10:30:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid incident ID format
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User cannot access this incident (ownership violation)
- `404 Not Found` - Incident not found
- `500 Internal Server Error` - Server error

---

### Get All Incidents

**GET** `/api/incidents`

Retrieve a paginated list of all incident reports with optional filtering. Requires authentication.

**Required Role:** `user`, `dispatcher`, `admin`

**Role-Specific Behavior:**
- Regular users see only incidents they created
- Dispatchers and admins see all incidents in the system

**Query Parameters:**

- `limit` (integer, optional) - Number of records to return (default: 20, max: 100)
- `offset` (integer, optional) - Number of records to skip (default: 0)
- `severity_level` (string, optional) - Filter by severity level (e.g., "high", "medium", "low")
- `status` (string, optional) - Filter by status (e.g., "pending", "resolved")

**Example:**

```
GET /api/incidents?limit=10&offset=0&severity_level=high&status=pending
```

**Response:** `200 OK`

```json
[
  {
    "report_id": 1,
    "user_id": 1,
    "incident_type": null,
    "severity_level": "high",
    "description": null,
    "latitude": 16.043021,
    "longitude": 120.3337627,
    "media_url": null,
    "status": "pending",
    "created_at": "2026-01-20T10:30:00.000Z"
  }
]
```

**Error Responses:**

- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid authentication token
- `500 Internal Server Error` - Server error

---

### Get My Incidents

**GET** `/api/incidents/user/my`

Retrieve a paginated list of incidents reported by the authenticated user. Requires authentication.

**Query Parameters:**

- `limit` (integer, optional) - Number of records to return (default: 20, max: 100)
- `offset` (integer, optional) - Number of records to skip (default: 0)

**Example:**

```
GET /api/incidents/user/my?limit=10&offset=0
```

**Response:** `200 OK`

```json
[
  {
    "report_id": 1,
    "user_id": 1,
    "incident_type": null,
    "severity_level": "high",
    "description": null,
    "latitude": 16.043021,
    "longitude": 120.3337627,
    "media_url": null,
    "status": "pending",
    "created_at": "2026-01-20T10:30:00.000Z"
  }
]
```

**Error Responses:**

- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid authentication token
- `500 Internal Server Error` - Server error

---

## Common Response Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters, missing required fields, or validation errors
- `401 Unauthorized` - Missing, invalid, or expired authentication token
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Pagination

All list endpoints support pagination using query parameters:

- `limit`: Maximum number of records to return (default: 20, max: 100)
- `offset`: Number of records to skip for pagination (default: 0)

**Example pagination:**

```
GET /api/responders?limit=20&offset=0   // First page
GET /api/responders?limit=20&offset=20  // Second page
GET /api/responders?limit=20&offset=40  // Third page
```

## Foreign Key Validation

The following endpoints validate foreign key relationships before creating or updating records:

**Dispatches:**

- `report_id` must reference an existing incident report
- `responder_id` must reference an existing responder

**Notifications:**

- `user_id` must reference an existing user
- `report_id` (if provided) must reference an existing incident report

---

## Admin API

**Required Role:** `admin` for all endpoints

All admin endpoints require the `admin` role and return `403 Forbidden` if accessed by other roles.

### List All Users

**GET** `/api/admin/users?page=1&limit=20`

Retrieve a paginated list of all active users in the system.

**Query Parameters:**

- `page` (integer, optional) - Page number (default: 1)
- `limit` (integer, optional) - Users per page (default: 20, max: 100)

**Response:** `200 OK`

```json
{
  "users": [
    {
      "user_id": 1,
      "email": "user@example.com",
      "phone_number": "+1234567890",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_active": true,
      "created_at": "2026-01-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Get User by ID

**GET** `/api/admin/users/:id`

Retrieve details for a specific user.

**Parameters:**

- `id` (integer) - User ID

**Response:** `200 OK` - Returns user object (as shown in List All Users)

**Error Responses:**

- `404 Not Found` - User not found

### Create User with Role

**POST** `/api/admin/users`

Create a new user and assign a role directly.

**Request Body:**

```json
{
  "email": "newuser@example.com", // required
  "password": "SecurePassword123", // required
  "phone_number": "+1234567890", // optional
  "first_name": "John", // optional
  "last_name": "Doe", // optional
  "role": "dispatcher" // optional, defaults to "user"
}
```

**Response:** `201 Created`

```json
{
  "message": "User created successfully",
  "user": {
    "user_id": 5,
    "email": "newuser@example.com",
    "phone_number": "+1234567890",
    "first_name": "John",
    "last_name": "Doe",
    "role": "dispatcher",
    "is_active": true,
    "created_at": "2026-01-20T10:30:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input or missing required fields
- `409 Conflict` - Email or phone number already exists

### Update User Role

**PUT** `/api/admin/users/:id/role`

Change a user's role.

**Parameters:**

- `id` (integer) - User ID

**Request Body:**

```json
{
  "role": "admin"
}
```

**Valid Roles:**

- `user` - Regular user
- `dispatcher` - Dispatcher/Admin
- `admin` - System Administrator

**Response:** `200 OK`

```json
{
  "message": "User role updated successfully",
  "user": { /* user object with new role */ }
}
```

**Error Responses:**

- `400 Bad Request` - Invalid role or last admin cannot be demoted
- `404 Not Found` - User not found

### Deactivate User

**PUT** `/api/admin/users/:id/deactivate`

Deactivate a user account (soft delete).

**Parameters:**

- `id` (integer) - User ID

**Request Body:**

```json
{
  "reason": "Account no longer needed" // optional
}
```

**Response:** `200 OK`

```json
{
  "message": "User deactivated successfully",
  "user": { /* user object with is_active: false */ }
}
```

**Error Responses:**

- `400 Bad Request` - Last admin cannot be deactivated
- `404 Not Found` - User not found

### Delete User Permanently

**DELETE** `/api/admin/users/:id`

Permanently delete a user from the system.

**Parameters:**

- `id` (integer) - User ID

**Response:** `200 OK`

```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**

- `400 Bad Request` - Last admin cannot be deleted
- `404 Not Found` - User not found

### Get System Statistics

**GET** `/api/admin/stats`

Retrieve system-wide statistics including user counts by role.

**Response:** `200 OK`

```json
{
  "total_users": 150,
  "by_role": {
    "user": 120,
    "dispatcher": 25,
    "admin": 5
  },
  "timestamp": "2026-01-20T10:30:00.000Z"
}
```

---

## Notes

1. **Full Updates Required**: PUT endpoints require all fields to be provided. This ensures data consistency and prevents partial updates that might leave records in an incomplete state.

2. **Timestamp Fields**: Fields like `dispatched_at` and `sent_at` are automatically set by the database and cannot be manually specified during creation.

3. **Nullable Fields**: Some fields can be set to `null` during updates (e.g., `organization`, `contact_number`, `availability_status`, `response_status`, `report_id`, `sent_via`).

4. **ID Fields**: Primary key fields (`responder_id`, `dispatch_id`, `notification_id`) are auto-generated and returned in responses.

---

## RBAC Manual Testing Guide

For comprehensive step-by-step instructions on manually testing RBAC using Postman, see [RBAC_POSTMAN_GUIDE.md](./RBAC_POSTMAN_GUIDE.md).

The guide includes:
- Setup instructions for creating test tokens for each role (user, dispatcher, admin)
- 5 complete test scenarios with example requests and expected responses
- Ownership restriction tests
- Authentication failure tests
- A ready-to-import Postman collection

**Quick Test Summary:**
- **Users:** Can create/read own incidents, cannot access dispatcher-only features
- **Dispatchers:** Full access to incidents, dispatches, responders; cannot manage users
- **Admins:** Unrestricted access to all endpoints including user management

See [RBAC_POSTMAN_GUIDE.md](./RBAC_POSTMAN_GUIDE.md) for complete manual testing procedures.
