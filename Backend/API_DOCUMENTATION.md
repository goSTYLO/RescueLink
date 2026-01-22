# RescueLink Backend API Documentation

## Base URL

```
http://localhost:3000/api
```

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

## Authentication API

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
  "email": "john@example.com" // optional
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
- `404 Not Found` - Incident report not found or Responder not found
- `500 Internal Server Error` - Server error

**Validation:**

- `report_id`: Must be a positive integer (required)
- `responder_id`: Must be a positive integer (required)
- `response_status`: Max 50 characters (optional)

---

### Get All Dispatches

**GET** `/api/dispatches`

Retrieve a paginated list of dispatches with optional filtering.

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

- `404 Not Found` - Notification not found
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

## Notes

1. **Full Updates Required**: PUT endpoints require all fields to be provided. This ensures data consistency and prevents partial updates that might leave records in an incomplete state.

2. **Timestamp Fields**: Fields like `dispatched_at` and `sent_at` are automatically set by the database and cannot be manually specified during creation.

3. **Nullable Fields**: Some fields can be set to `null` during updates (e.g., `organization`, `contact_number`, `availability_status`, `response_status`, `report_id`, `sent_via`).

4. **ID Fields**: Primary key fields (`responder_id`, `dispatch_id`, `notification_id`) are auto-generated and returned in responses.
