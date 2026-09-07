# RescueLink API Documentation

## Base URLs

- **Backend API base**: `http://localhost:3000/api`
- **AI service base**: `http://localhost:8000`
- **Blockchain service base**: `http://localhost:8001`
- **Web Dashboard**: `http://localhost:5173`

All API responses use JSON format. Cross-Origin Resource Sharing (CORS) is enabled to allow frontend applications to communicate with the backend.

## Authentication And Authorization

### JWT Bearer Tokens

All protected backend routes require a JWT bearer token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens are returned from login endpoints and contain the following claims:

- `user_id`: Unique user identifier
- `email` or `phone`: User contact information
- `role`: User role (user, dispatcher, admin, supervisor, responder, dept-admin)
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp (typically 7 days)

Tokens must be base64-encoded and valid. Expired or malformed tokens will be rejected.

### Common Authentication Errors

- **401 Unauthorized - Missing Token**: Request lacks `Authorization` header or header is empty
- **401 Unauthorized - Invalid Format**: Authorization header is not in format `Bearer <token>`
- **401 Unauthorized - Expired Token**: Token has passed its expiration time; user must re-authenticate
- **401 Unauthorized - Invalid Signature**: Token has been tampered with or signed with wrong key
- **401 Unauthorized - Blacklisted Token**: User has logged out and token was added to blacklist

### Role-Based Access Control (RBAC)

RescueLink implements a comprehensive role-based authorization system with the following roles:

**Primary Roles:**

- **user**: Regular mobile app users who report incidents; can create and view their own reports only
- **dispatcher**: Web app administrators who manage incidents, dispatch responders, and oversee operations
- **admin**: System administrators with full access to all resources, user management, and configuration

**Operational Roles:**

- **supervisor**: Operational supervisors who manage teams and responders
- **responder**: Emergency response personnel who receive and respond to dispatch assignments
- **dept-admin**: Department-level administrators restricted to their department's resources

**Permission Model:**

- Users can only access resources they own (incidents, notifications)
- Dispatchers can access all incidents and create dispatch assignments
- Admins have unrestricted access to all resources
- Department admins are scoped to their department
- Responders can view assigned incidents and update their availability status

### Ownership Protection

Ownership checks are enforced at the API level:

- Regular users cannot view, update, or delete incidents created by other users
- Regular users cannot access notifications intended for other users
- Download endpoints for audio/media files check ownership before streaming content
- Dispatchers and admins bypass ownership checks and can access all resources
- Requests that violate ownership rules return `403 Forbidden`

### How To Obtain A Token

**Mobile User Registration:**

```
POST /api/auth/register
{
  "phone": "+1234567890",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePass123!",
  "email": "john@example.com"
}
```

**Mobile User Login:**

```
POST /api/auth/login
{
  "phone": "+1234567890",
  "password": "SecurePass123!"
}
```

**Dispatcher Login (With Optional MFA):**

```
POST /api/auth/dispatcher/login
{
  "email": "dispatcher@rescuelink.test",
  "password": "dispatcher123"
}
```

If MFA is enabled, response includes `sessionToken` instead of `token`. Verify OTP via:

```
POST /api/auth/dispatcher/verify-otp
{
  "sessionToken": "session_xyz",
  "otp": "123456"
}
```

**Logout (Invalidate Token):**

```
POST /api/auth/logout
Authorization: Bearer <token>
```

## Rate Limiting

### General API Rate Limits

Rate limiting is enforced per IP address to prevent abuse and ensure fair resource allocation:

- **Development Environment**: 2000 requests per 15-minute window per IP address
- **Production Environment**: 500 requests per 15-minute window per IP address
  Response Format And Error Handling

### Success Responses

All successful API responses follow a consistent JSON structure:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "id": 123,
    "name": "Example Resource",
    "createdAt": "2026-03-24T10:30:00Z"
  }
}
```

### Error Response Format

All error responses include descriptive messaging:

```json
{
  "success": false,
  "error": "Forbidden",
  "message": "You do not have permission to access this endpoint",
  "code": "PERMISSION_DENIED",
  "details": {
    "required_role": "dispatcher",
    "user_role": "user"
  }
}
```

### HTTP Status Codes

**Success Codes:**

- `200 OK`: Request succeeded; response body contains result
- `201 Created`: Resource created successfully; includes new resource in response
- `204 No Content`: Request succeeded; no response body (typical for DELETE)

**Client Error Codes:**

- `400 Bad Request`: Request validation failed (missing fields, invalid format, invalid values). Response includes field-specific error messages.
- `401 Unauthorized`: Authentication failed (missing token, invalid token, expired token). User must re-authenticate.
- `403 Forbidden`: User is authenticated but lacks permission (insufficient role, trying to access another user's resource). Check user role and resource ownership.
- `404 Not Found`: Resource does not exist or has been deleted. Verify the resource ID is correct.
- `409 Conflict`: Request conflicts with current state (duplicate creation, invalid state transition). Cannot proceed without resolving conflict.
- `429 Too Many Requests`: Rate limit exceeded. Implement backoff and retry after suggested delay.

**Server Error Codes:**

- `500 Internal Server Error`: Unexpected server error. Check logs and retry after a delay.
- `503 Service Unavailable`: Server maintenance or critical service dependency unavailable (e.g., AI service, scanner, database). Returns with `Retry-After` header.

### Validation Errors

Validation failures return `400 Bad Request` with detailed error information:

```json
{
  "error": "Valida And Resources

### Authentication Endpoints (`/api/auth/*`)

Handle user registration, login, password reset, and token management:

- `POST /api/auth/register` (public): Register new mobile user with phone and password
- `POST /api/auth/login` (public): Login mobile user and receive JWT token
- `POST /api/auth/dispatcher/login` (public): Login dispatcher with email, optionally triggers OTP
- `POST /api/auth/dispatcher/verify-otp` (public): Verify OTP code and receive JWT token
- `POST /api/auth/dispatcher/signup` (public): Create new dispatcher account
- `POST /api/auth/onboard-phone` (public): Complete phone verification flow with Firebase token
- `POST /api/auth/forgot-password` (public): Request password reset email
- `POST /api/auth/reset-password-with-token` (public): Complete password reset with token
- `GET /api/auth/me` (protected): Get current authenticated user profile
- `PATCH /api/auth/me` (protected): Update current user profile (name, email, address)
- `POST /api/auth/change-password` (protected): Change password for authenticated user
- `POST /api/auth/logout` (protected): Invalidate token (adds to blacklist, prevents reuse)

### Incident Management Endpoints (`/api/incidents/*`)

Create, retrieve, and manage emergency incidents with full lifecycle support:

- `POST /api/incidents/emergency` (user): Create quick emergency incident at location with minimal data
- `POST /api/incidents/with-audio` (user): Create incident with audio recording and optional photos/videos
  - Triggers automatic AI transcription and incident classification
  - Performs security scanning (signature check, deep scan workflow)
  - Supports fail-open mode if scanner unavailable
- `GET /api/incidents` (dispatcher, admin): List all incidents with optional filters
  - Filters: `search` (report ID or description), `incident_type`, `barangay`, `status`, `severity`
  - Pagination: `limit` (max 100), `offset`
- `GET /api/incidents/:id` (owner, dispatcher, admin): Retrieve incident details
  - Includes reporter info, location, timeline, status history
- `GET /api/incidents/:id/with-ai` (owner, dispatcher, admin): Retrieve incident with AI classification
  - Includes transcription, primary/secondary incident types, confidence scores
  - Used as primary data source for unified incident tracking screens
- `GET /api/incidents/:id/audio` (owner, dispatcher, admin): Download original incident audio file
  - Blocked if incident is quarantined
  - Protected by ownership checks
- `GET /api/incidents/:id/media/:index` (owner, dispatcher, admin): Download media file (photo/video) by index
  - `index` starts at 0 for first media file
  - Blocked if incident is quarantined
- `PATCH /api/incidents/:id/status` (dispatcher, admin): Update incident status
  - Allowed transitions: pending → verified → in_progress → resolved → closed
  - `closed` status requires force close permission (dispatcher/admin only)
  - Triggers resource release (teams, responders, department units)
- `POST /api/incidents/:id/confirm-resolution` (owner): Reporter confirms incident resolution
  - Only available after incident is marked `resolved` by dispatcher/admin
  - Auto-transitions incident from `resolved` → `closed`
  - Persists confirmation timestamp and actor ID
- `POST /api/incidents/:id/verify` (dispatcher, admin): Record incident verification on blockchain
  - Creates immutable record of incident verification
  - Returns blockchain transaction hash and gas metrics
- `POST /api/incidents/:id/reclassify` (dispatcher, admin): Manually override AI incident classification
  - Allows updating incident type and severity based on dispatcher judgment
  - Useful when AI confidence is low or misclassification occurs
- `POST /api/incidents/:id/link-duplicate` (dispatcher, admin): Manually link two incidents as duplicates
  - Establishes parent-child relationship for duplicate incident tracking
  - Records linking timestamp and actor
- `POST /api/incidents/:id/unlink-duplicate` (dispatcher, admin): Remove duplicate link
- `GET /api/incidents/:id/duplicates` (dispatcher, admin): List confirmed duplicate incidents
- `GET /api/incidents/:id/potential-duplicates` (dispatcher, admin): List incidents flagged as potential duplicates
  - Based on geospatial proximity and temporal proximity
  - Allows dispatcher to manually review and link if desired
- `GET /api/incidents/:id/coordination-notes` (dispatcher, admin): Retrieve internal coordination notes
- `POST /api/incidents/:id/coordination-notes` (dispatcher, admin): Add internal coordination note

### Dispatch Assignment Endpoints (`/api/dispatches/*`)

Manage emergency response dispatch and resource allocation:

- `POST /api/dispatches` (dispatcher, admin, department-admin, department-head): Create dispatch assignment
  - **Single responder mode**: `{ report_id, responder_id }`
  - **Grouped team mode**: `{ report_id, department_code, team_name }` - backend auto-selects available team members
  - Returns assignment summary with assigned responder count and failure reasons if applicable
  - Triggers auto-transition of incident from `verified` → `in_progress` on success
  - Second primary team (or duplicate dept notify) returns `409 PRIMARY_TEAM_ALREADY_ASSIGNED` / `DEPARTMENT_ALREADY_NOTIFIED` — use reassign-team
- `POST /api/dispatches/confirm-suggestion` (dispatcher, admin, department-admin, department-head): Apply stored hybrid suggestion as auto-team
- `POST /api/dispatches/reassign-team` (same roles; dept roles scoped): Release busy team, write new group; `reason` min 10 characters
- `PATCH /api/dispatches/me/status` (responder): Update this member's `dispatches.response_status`; does not resolve the incident unless the user is also the volunteer acceptor
- `GET /api/dispatches` (dispatcher, admin): List all dispatches with optional filters
  - Filters: `status`, `incident_id`, `responder_id`
  - Includes responder details and assignment metadata
- `GET /api/dispatches/:id` (dispatcher, admin): Retrieve specific dispatch details
- `PUT /api/dispatches/:id` (dispatcher, admin): Update dispatch (reassign responder, change status)
- `DELETE /api/dispatches/:id` (dispatcher, admin): Cancel dispatch assignment
- `POST /api/dispatches/undo-department` (dispatcher, admin): Undo department notification for an incident
  - Useful if wrong department was initially notified

### Responder And Team Management (`/api/responders/*`)

Manage emergency responders and operational teams:

- `GET /api/responders/me/profile` (responder): Self profile
- `GET /api/responders/me/assigned-incidents` (responder): Incidents where this account is on an assigned team (`my_response_status`, `assigned_team_name`)
- `GET /api/responders/me/team` (responder): Roster for teams this responder belongs to
- `PATCH /api/responders/me/online-status` (responder): Online/offline + optional GPS
- `POST /api/responders` (admin): Create new responder record
- `GET /api/responders/:id` (dispatcher, admin): Get responder details
- `PUT /api/responders/:id` (admin): Update responder information
- `DELETE /api/responders/:id` (admin): Remove responder
- `PATCH /api/responders/:id/status` (dispatcher, admin): Update responder availability status
  - Options: `available`, `standby`, `busy`, `off-duty`
- `GET /api/responders/teams` (dispatcher, admin): List all responder teams
- `POST /api/responders/teams` (admin): Create new team
- `GET /api/responders/teams/:teamId` (dispatcher, admin): Get team details
- `PUT /api/responders/teams/:teamId` (admin): Update team
- `DELETE /api/responders/teams/:teamId` (admin): Delete team
- `PATCH /api/responders/teams/:teamId/status` (dispatcher, admin): Update team availability
- `GET /api/responders/teams/:teamId/members` (dispatcher, admin): List team members
- `POST /api/responders/teams/:teamId/members` (admin): Add responder to team
- `DELETE /api/responders/teams/:teamId/members/:responderId` (admin): Remove responder from team

### Department Management (`/api/departments/*`)

Manage departments, units, and personnel:

- `GET /api/departments` (dispatcher, admin): List all departments
- `POST /api/departments` (admin): Create new department
- `GET /api/departments/:id` (dispatcher, admin): Get department details with metrics
- `PUT /api/departments/:id` (admin): Update department information
- `DELETE /api/departments/:id` (admin): Delete department
- `GET /api/departments/:id/metrics` (dispatcher, admin): Get department operational metrics
  - Total responders, available responders, active incidents, pending assignments
- `GET /api/departments/:id/units` (dispatcher, admin): List department units/vehicles
- `POST /api/departments/:id/units` (admin): Create new unit
- `PUT /api/departments/:id/units/:unitId` (admin): Update unit
- `DELETE /api/departments/:id/units/:unitId` (admin): Delete unit
- `POST /api/departments/:id/units/:unitId/assign` (dispatcher, admin): Assign unit to incident
- `GET /api/departments/:id/personnel` (dispatcher, admin): List department personnel
- `POST /api/departments/:id/personnel` (admin): Add personnel to department
- `PUT /api/departments/:id/personnel/:personnelId` (admin): Update personnel
- `DELETE /api/departments/:id/personnel/:personnelId` (admin): Remove personnel

### Notification System (`/api/notifications/*`)

Handles incident and system notifications for all users:

- `GET /api/notifications` (protected): List user's notifications
  - Regular users see only their own notifications (enforced server-side)
  - Dispatchers/admins can see all notifications
  - Includes joined incident type and status information
  - Supports pagination and filtering by read status
- `GET /api/notifications/:id` (protected): Get specific notification
  - Returns `403` if user tries to access another user's notification
- `PUT /api/notifications/:id` (protected): Mark notification as read/unread
- `DELETE /api/notifications/:id` (protected): Delete notification
- `POST /api/notifications/mark-all-read` (protected): Mark all notifications as read in one operation
  - Returns count of notifications marked
- `GET /api/notifications/unread-count` (protected): Get count of unread notifications
  - Used for badge display on mobile/web

### Location Services (`/api/location/*`)

Geolocation and geographic analysis endpoints:

- `POST /api/location/check` (public): Validate coordinates against city boundary
  - Checks if coordinates are within operational area (Dagupan City)
- `GET /api/location/barangay` (protected): Get barangay name from coordinates
  - Performs reverse geocoding to determine administrative division
- `GET /api/location/search` (protected): Geocode address to coordinates
  - Returns list of candidate locations with confidence scores
- `GET /api/location/reverse` (protected): Reverse geocode coordinates to address
- `POST /api/location/closest-units` (protected): Find closest responder units to location
  - Returns units sorted by distance with ETA estimates
- `POST /api/location/geofence-alerts` (protected): Check if incident is near sensitive areas
  - Geofence analysis for school zones, hospitals, government buildings
- `GET /api/location/heatmap` (protected): Get incident density heatmap data
  - Aggregates incident locations for visualization
  - Used for strategic resource planning

### Admin Management (`/api/admin/*`)

System administration and user management (admin-only):

- `GET /api/admin/users` (admin): List all system users
  - Includes role, status, recent activity
- `POST /api/admin/users` (admin): Create new user with role assignment
- `GET /api/admin/users/:id` (admin): Get user details
- `DELETE /api/admin/users/:id` (admin): Permanently delete user account
- `PUT /api/admin/users/:id/role` (admin): Update user role
- `PUT /api/admin/users/:id/deactivate` (admin): Deactivate user account (soft delete)
- `GET /api/admin/stats` (admin): Get system-wide statistics
  - Total users by role, incidents created, response times, system health

### Audit Logging (`/api/audit-logs/*`)

Access and review security audit trails:

- `GET /api/audit-logs` (dispatcher, admin): List audit logs
  - Dispatchers see only their own logs
  - Admins see all logs
  - Includes action, resource, actor, timestamp
- `GET /api/audit-logs/admin` (admin): List all audit logs without restriction

- [../backend/API_DOCUMENTATION.md](../backend/API_DOCUMENTATION.md)

### Dispatches

- Assignment and workflow routes under `/api/dispatches`
- Includes grouped assignment patterns and status-aware assignment behavior

Reference:

- [../backend/API_DOCUMENTATION.md](../backend/API_DOCUMENTATION.md)

### Responders And Departments

- Responder/team and department operations support dispatcher/admin workflows

Reference:

- [../backend/API_DOCUMENTATION.md](../backend/API_DOCUMENTATION.md)

### Notifications

- User-scoped notifications, unread count, mark-all-read
- Relevant route examples:
  - `GET /api/notifications`
  - `GET /api/notifications/unread-count`
  - `POST /api/notifications/mark-all-read`

Reference:

- [../backend/API_DOCUMENTATION.md](../backend/API_DOCUMENTATION.md)

### Location And Admin

- Geolocation and administrative route groups
- Admin endpoints are role-restricted

Reference:

- [../backend/API_DOCUMENTATION.md](../backend/API_DOCUMENTATION.md)

## AI And Blockchain Integration Touchpoints

- Backend uses AI service for transcription/classification behavior in incident workflows
- Backend verify flow can call blockchain service for immutable verification records

References:

- [../backend/AI_INTEGRATION_PLAN.md](../backend/AI_INTEGRATION_PLAN.md)
- [../Blockchain/README.md](../Blockchain/README.md)

## OpenAPI And Deeper Contract

- Canonical OpenAPI file: [../Backend/api-spec/swagger.json](../Backend/api-spec/swagger.json)
- Extended backend endpoint detail: [../backend/API_DOCUMENTATION.md](../backend/API_DOCUMENTATION.md)
```
