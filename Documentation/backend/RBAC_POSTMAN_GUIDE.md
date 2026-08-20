# RBAC Manual Testing Guide (Postman)

This guide provides comprehensive step-by-step instructions for manually testing Role-Based Access Control (RBAC) using Postman with pre-configured test accounts and actual JWT tokens.

---

## Quick Setup (5 minutes)

### Pre-configured Test Accounts

These accounts are seeded by `node scripts/seed-db.js`:

| Role | Login Method | Credentials |
|------|---|---|
| **Admin** | Phone or Email | `admin@rescuelink.test` / `admin123`<br/>`admin2@rescuelink.test` / `admin123` |
| **Dispatcher** | Phone or Email | `dispatcher@rescuelink.test` / `dispatcher123`<br/>`dispatcher2@rescuelink.test` / `dispatcher123` |
| **Supervisor** | Phone or Email | `supervisor@rescuelink.test` / `supervisor123`<br/>`supervisor2@rescuelink.test` / `supervisor123` |
| **Responder** | Phone or Email | `responder@rescuelink.test` / `responder123`<br/>`responder2@rescuelink.test` / `responder123` |
| **User** | Phone or Email | `user@rescuelink.test` / `user123`<br/>`user2@rescuelink.test` / `user123` |

### JWT Tokens

Do not use pre-generated tokens. Generate fresh tokens from the login endpoints during testing.

---

### Set Up Postman Environment (2 steps)

1. **Create Environment:**
   - In Postman, click **Settings** (bottom left)
   - Click **Add** under "Environments"
   - Name it: `RescueLink RBAC Tests`

2. **Add These Variables:**

| Variable | Value |
|---|---|
| `base_url` | `http://localhost:3000/api` |
| `user_token` | (Set after login) |
| `dispatcher_token` | (Set after login) |
| `supervisor_token` | (Set after login) |
| `responder_token` | (Set after login) |
| `admin_token` | (Set after login) |
| `user_id` | (Set from seeded user) |
| `responder_id` | `21` |
| `report_id` | (Will be created in Test 1.1) |

3. **Save and Select** the environment from the top-right dropdown

---

## Test Scenario 1: User Access Control ✅

**Objective:** Verify that regular users can create incidents and cannot access dispatcher-only features.

### 1.1: User Creates Emergency Incident

**Request:**
```http
POST {{base_url}}/incidents/emergency
Authorization: Bearer {{user_token}}
Content-Type: application/json

{
  "latitude": 16.0419,
  "longitude": 120.5351
}
```

**Expected Response:** `201 Created`

```json
{
  "success": true,
  "message": "Emergency incident reported successfully",
  "incident": {
    "report_id": 500,
    "user_id": 91,
    "incident_type": null,
    "severity_level": "high",
    "description": null,
    "latitude": 16.0419,
    "longitude": 120.5351,
    "barangay": "Matalino",
    "media_url": null,
    "transcription": null,
    "audio_path": null,
    "status": "pending",
    "created_at": "2026-02-19T10:30:00.000Z"
  }
}
```

**✅ Success Criteria:**
- Status is `201 Created`
- `report_id` is returned (copy this value!)
- `severity_level` is automatically set to `high`
- `barangay` is auto-resolved from coordinates

**Next Step:** Copy the `report_id` (e.g., 500) and set it as the `report_id` variable in Postman for use in dispatcher tests.

---

### 1.2: User Reads Their Own Incident

**Request:**
```http
GET {{base_url}}/incidents/{{report_id}}
Authorization: Bearer {{user_token}}
```

**Expected Response:** `200 OK`

```json
{
  "report_id": 500,
  "user_id": 91,
  "incident_type": null,
  "severity_level": "high",
  "description": null,
  "latitude": 16.0419,
  "longitude": 120.5351,
  "barangay": "Matalino",
  "status": "pending",
  "reporter_first_name": null,
  "reporter_last_name": null,
  "reporter_phone": "+639666638967",
  "created_at": "2026-02-19T10:30:00.000Z"
}
```

**✅ Success Criteria:**
- Status is `200 OK`
- `user_id` matches the user token (91)
- Full incident details returned

---

### 1.3: User CANNOT Create Dispatch ❌

**Request:**
```http
POST {{base_url}}/dispatches
Authorization: Bearer {{user_token}}
Content-Type: application/json

{
  "report_id": 500,
  "responder_id": 21,
  "response_status": "assigned"
}
```

**Expected Response:** `403 Forbidden`

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this endpoint"
}
```

**✅ Success Criteria:**
- Status is `403 Forbidden`
- User role (user) lacks permission to create/manage dispatches
- Dispatchers/admins only can access dispatch endpoints

---

### 1.4: User CANNOT Create Responder ❌

**Request:**
```http
POST {{base_url}}/responders
Authorization: Bearer {{user_token}}
Content-Type: application/json

{
  "name": "Test Ambulance Unit",
  "organization": "City Medical",
  "contact_number": "+639123456789",
  "availability_status": "available"
}
```

**Expected Response:** `403 Forbidden`

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this endpoint"
}
```

**✅ Success Criteria:**
- Status is `403 Forbidden`
- Users cannot create responders
- Only dispatchers and admins can manage responders

---

### 1.5: User Lists Own Incidents (Auto-filtered) ✅

**Request:**
```http
GET {{base_url}}/incidents?limit=10&offset=0
Authorization: Bearer {{user_token}}
```

**Expected Response:** `200 OK` (Array of incidents, filtered to user's only)

```json
[
  {
    "report_id": 500,
    "user_id": 91,
    "incident_type": null,
    "severity_level": "high",
    "description": null,
    "latitude": 16.0419,
    "longitude": 120.5351,
    "barangay": "Matalino",
    "status": "pending",
    "reporter_phone": "+639666638967",
    "created_at": "2026-02-19T10:30:00.000Z"
  }
]
```

**✅ Success Criteria:**
- Status is `200 OK`
- Returns **only** incidents where `user_id = 91`
- No incidents from other users in the list
- API automatically filters by ownership

---

### 1.6: User CANNOT Access Audit Logs ❌

**Request:**
```http
GET {{base_url}}/audit-logs
Authorization: Bearer {{user_token}}
```

**Expected Response:** `403 Forbidden`

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this endpoint"
}
```

**✅ Success Criteria:**
- Status is `403 Forbidden`
- Users cannot view any audit logs
- Only dispatchers (own) and admins (all) can access audit logs

---

## Test Scenario 2: Dispatcher Access Control ✅

**Objective:** Verify dispatchers have full access to incidents, dispatches, and responders, but cannot manage users.

### 2.1: Dispatcher Creates Incident

**Request:**
```http
POST {{base_url}}/incidents/emergency
Authorization: Bearer {{dispatcher_token}}
Content-Type: application/json

{
  "latitude": 16.0419,
  "longitude": 120.5351
}
```

**Expected Response:** `201 Created`

**✅ Success Criteria:**
- Status is `201 Created`
- Dispatcher can create incidents just like users
- Both user and dispatcher roles can create incidents

---

### 2.2: Dispatcher Creates Dispatch ✅

**Request:**
```http
POST {{base_url}}/dispatches
Authorization: Bearer {{dispatcher_token}}
Content-Type: application/json

{
  "report_id": 500,
  "responder_id": 21,
  "response_status": "assigned"
}
```

**Expected Response:** `201 Created`

```json
{
  "dispatch_id": 102,
  "report_id": 500,
  "responder_id": 21,
  "response_status": "assigned",
  "dispatched_at": "2026-02-19T10:35:00.000Z"
}
```

**✅ Success Criteria:**
- Status is `201 Created`
- `dispatch_id` is auto-generated
- Uses the `report_id` from Test 1.1
- `responder_id` 21 is pre-configured and valid

**Required Fields:**
- `report_id` (integer) - Must be valid incident ID (e.g., 500)
- `responder_id` (integer) - Must be valid responder ID (e.g., 21)
- `response_status` (string, optional) - e.g., "assigned", "dispatched", "completed"

---

### 2.3: Dispatcher Creates Responder ✅

**Request:**
```http
POST {{base_url}}/responders
Authorization: Bearer {{dispatcher_token}}
Content-Type: application/json

{
  "name": "Fire Engine Unit 7",
  "organization": "City Fire Department",
  "contact_number": "+639171234567",
  "availability_status": "available"
}
```

**Expected Response:** `201 Created`

```json
{
  "responder_id": 25,
  "name": "Fire Engine Unit 7",
  "organization": "City Fire Department",
  "contact_number": "+639171234567",
  "availability_status": "available",
  "created_at": "2026-02-19T10:40:00.000Z"
}
```

**✅ Success Criteria:**
- Status is `201 Created`
- `responder_id` is auto-generated
- All fields are optional except `name`
- Dispatcher can create responders; user cannot

**Responder Fields:**
- `name` (string, required) - Unit name (1-255 chars)
- `organization` (string, optional) - Station/department name
- `contact_number` (string, optional) - Phone (max 20 chars)
- `availability_status` (string, optional) - "available", "unavailable", "on_duty", etc.

---

### 2.4: Dispatcher Lists All Incidents (No Filter) ✅

**Request:**
```http
GET {{base_url}}/incidents?limit=10&offset=0
Authorization: Bearer {{dispatcher_token}}
```

**Expected Response:** `200 OK` (All incidents from all users)

```json
[
  {
    "report_id": 500,
    "user_id": 91,
    "incident_type": null,
    "severity_level": "high",
    "barangay": "Matalino",
    "status": "pending",
    "created_at": "2026-02-19T10:30:00.000Z"
  },
  {
    "report_id": 501,
    "user_id": 88,
    "incident_type": "medical",
    "severity_level": "medium",
    "barangay": "Pantal",
    "status": "pending",
    "created_at": "2026-02-18T14:20:00.000Z"
  }
]
```

**✅ Success Criteria:**
- Status is `200 OK`
- Returns incidents from **all users**, not just dispatcher's
- No `user_id` filtering applied
- **Key Difference from User (Test 1.5):** User only sees their own incidents; dispatcher sees all

---

### 2.5: Dispatcher Reads Own Audit Logs ✅

**Request:**
```http
GET {{base_url}}/audit-logs?limit=10&offset=0
Authorization: Bearer {{dispatcher_token}}
```

**Expected Response:** `200 OK` (Only dispatcher's own actions)

```json
[
  {
    "action_id": 501,
    "user_id": 92,
    "action": "dispatch_create",
    "resource_id": 102,
    "action_type": "SUCCESS",
    "timestamp": "2026-02-19T10:35:00.000Z"
  },
  {
    "action_id": 500,
    "user_id": 92,
    "action": "responder_create",
    "resource_id": 25,
    "action_type": "SUCCESS",
    "timestamp": "2026-02-19T10:40:00.000Z"
  }
]
```

**✅ Success Criteria:**
- Status is `200 OK`
- All logs have `user_id = 92` (the dispatcher)
- No logs from other users appear
- Automatically filtered by dispatcher's user_id

---

### 2.6: Dispatcher CANNOT Manage Users ❌

**Request:**
```http
GET {{base_url}}/admin/users
Authorization: Bearer {{dispatcher_token}}
```

**Expected Response:** `403 Forbidden`

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this endpoint"
}
```

**✅ Success Criteria:**
- Status is `403 Forbidden`
- Dispatchers cannot access `/admin/*` endpoints
- Only admins can manage users
- Dispatcher role lacks `users:manage` permission

---

## Test Scenario 3: Admin Access Control ✅

**Objective:** Verify admins have unrestricted access to all endpoints.

### 3.1: Admin Lists All Users ✅

**Request:**
```http
GET {{base_url}}/admin/users?limit=10&offset=0
Authorization: Bearer {{admin_token}}
```

**Expected Response:** `200 OK`

```json
[
  {
    "user_id": 91,
    "phone_number": "+639666638967",
    "email": null,
    "first_name": null,
    "last_name": null,
    "role": "user",
    "is_active": true,
    "created_at": "2026-01-15T10:00:00.000Z"
  },
  {
    "user_id": 92,
    "phone_number": null,
    "email": "aabe.tamayo.up@phinmaed.com",
    "first_name": "Aabe",
    "last_name": "Tamayo",
    "role": "dispatcher",
    "is_active": true,
    "created_at": "2026-01-10T09:00:00.000Z"
  }
]
```

**✅ Success Criteria:**
- Status is `200 OK`
- Returns all users (no filtering)
- All user fields visible
- Only admin role can access this endpoint

---

### 3.2: Admin Creates New User ✅

**Request:**
```http
POST {{base_url}}/admin/users
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "email": "newdispatcher@example.com",
  "password": "SecurePass123",
  "first_name": "New",
  "last_name": "Dispatcher",
  "role": "dispatcher"
}
```

**Expected Response:** `201 Created`

```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "user_id": 95,
    "email": "newdispatcher@example.com",
    "first_name": "New",
    "last_name": "Dispatcher",
    "role": "dispatcher",
    "is_active": true,
    "phone_number": null
  }
}
```

**✅ Success Criteria:**
- Status is `201 Created`
- User created with specified role
- `user_id` auto-generated
- Admin can set user role directly

**Required Fields:**
- `email` (string) - Valid email format, max 255 chars
- `password` (string) - 8-128 chars, min 1 letter + 1 number
- `first_name` (string) - 1-100 chars
- `last_name` (string) - 1-100 chars
- `role` (string) - "user", "dispatcher", or "admin"

---

### 3.3: Admin Updates User Role ✅

**Request:**
```http
PUT {{base_url}}/admin/users/91/role
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "role": "dispatcher"
}
```

**Expected Response:** `200 OK`

```json
{
  "success": true,
  "message": "User role updated successfully",
  "user": {
    "user_id": 91,
    "phone_number": "+639666638967",
    "role": "dispatcher",
    "is_active": true
  }
}
```

**✅ Success Criteria:**
- Status is `200 OK`
- User role changed from "user" to "dispatcher"
- Only admin can change user roles
- Immediate effect (no login required)

**Note:** You can also change user 91's role back to "user" to reset for future tests.

---

### 3.4: Admin Views System Statistics ✅

**Request:**
```http
GET {{base_url}}/admin/stats
Authorization: Bearer {{admin_token}}
```

**Expected Response:** `200 OK`

```json
{
  "total_users": 95,
  "by_role": {
    "user": 75,
    "dispatcher": 15,
    "admin": 5
  },
  "timestamp": "2026-02-19T11:00:00.000Z"
}
```

**✅ Success Criteria:**
- Status is `200 OK`
- Returns total user count and breakdown by role
- Only admin can access statistics
- Useful for system monitoring

---

### 3.5: Admin Lists All Incidents (No Filter) ✅

**Request:**
```http
GET {{base_url}}/incidents?limit=10&offset=0
Authorization: Bearer {{admin_token}}
```

**Expected Response:** `200 OK` (All incidents from all users)

**✅ Success Criteria:**
- Status is `200 OK`
- Returns all incidents, no filtering
- Admin has unrestricted read access

---

### 3.6: Admin Reads All Audit Logs ✅

**Request:**
```http
GET {{base_url}}/audit-logs?limit=10&offset=0
Authorization: Bearer {{admin_token}}
```

**Expected Response:** `200 OK`

```json
[
  {
    "action_id": 501,
    "user_id": 92,
    "action": "dispatch_create",
    "resource_id": 102,
    "action_type": "SUCCESS",
    "timestamp": "2026-02-19T10:35:00.000Z"
  },
  {
    "action_id": 500,
    "user_id": 91,
    "action": "incident_create",
    "resource_id": 500,
    "action_type": "SUCCESS",
    "timestamp": "2026-02-19T10:30:00.000Z"
  }
]
```

**✅ Success Criteria:**
- Status is `200 OK`
- Returns logs from all users (not filtered)
- Admin can see all actions system-wide
- Useful for system auditing

---

## Test Scenario 4: Ownership Restrictions ✅

**Objective:** Verify users are restricted to their own resources.

### 4.1: User Reads Own Incident ✅

**Request:**
```http
GET {{base_url}}/incidents/{{report_id}}
Authorization: Bearer {{user_token}}
```

**Expected Response:** `200 OK`

**✅ Success Criteria:**
- Status is `200 OK`
- User successfully accesses their own incident
- Ownership check passes

---

### 4.2: User CANNOT Read Other User's Incident ❌

**Request:**
```http
GET {{base_url}}/incidents/1
Authorization: Bearer {{user_token}}
```

**Expected Response:** `403 Forbidden`

```json
{
  "error": "Forbidden. You can only access your own incident."
}
```

**✅ Success Criteria:**
- Status is `403 Forbidden`
- User cannot access incidents they don't own
- Ownership check enforced by API
- Different user_id in token vs incident owner

---

### 4.3: Dispatcher Bypasses Ownership Check ✅

**Request:**
```http
GET {{base_url}}/incidents/1
Authorization: Bearer {{dispatcher_token}}
```

**Expected Response:** `200 OK` or `404 Not Found`

```json
{
  "report_id": 1,
  "user_id": 88,
  "incident_type": "medical",
  "severity_level": "medium",
  ...
}
```

**✅ Success Criteria:**
- Status is `200 OK` (if incident exists) or `404 Not Found` (if it doesn't)
- Dispatcher can access **any** incident regardless of ownership
- No ownership restriction for dispatcher role
- Admin also bypasses ownership checks

---

## Test Scenario 5: Authentication Issues ❌

**Objective:** Verify proper error handling for authentication problems.

### 5.1: Missing Authorization Header ❌

**Request:**
```http
GET {{base_url}}/incidents
```

**(No Authorization header)**

**Expected Response:** `401 Unauthorized`

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```

---

### 5.2: Invalid Token ❌

**Request:**
```http
GET {{base_url}}/incidents
Authorization: Bearer invalid_token_12345
```

**Expected Response:** `401 Unauthorized`

```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

---

### 5.3: Wrong Bearer Format ❌

**Request:**
```http
GET {{base_url}}/incidents
Authorization: {{user_token}}
```

**(Missing "Bearer" prefix)**

**Expected Response:** `401 Unauthorized`

```json
{
  "error": "Unauthorized",
  "message": "Invalid authorization format. Use: Bearer <token>"
}
```

---

## Permission Matrix Summary

| Feature | User | Dispatcher | Admin |
|---|:---:|:---:|:---:|
| Create Incident | ✅ | ✅ | ✅ |
| Read Own Incident | ✅ | ✅ | ✅ |
| Read All Incidents | ❌ | ✅ | ✅ |
| List Incidents | ✅ (own) | ✅ (all) | ✅ (all) |
| Create Dispatch | ❌ | ✅ | ✅ |
| Manage Dispatches | ❌ | ✅ | ✅ |
| Create Responder | ❌ | ✅ | ✅ |
| Manage Responders | ❌ | ✅ | ✅ |
| View Own Audit Logs | ❌ | ✅ | ✅ |
| View All Audit Logs | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| Update User Roles | ❌ | ❌ | ✅ |
| View System Stats | ❌ | ❌ | ✅ |

---

## Troubleshooting

**"Forbidden" error when testing as dispatcher?**
- Ensure you're using the correct `dispatcher_token`
- Check tokens haven't expired (tokens expire 2026-02-19)
- Verify environment variable is set correctly

**"User not found" or 404 errors?**
- Ensure user_id 91 and 92 exist in your database
- Check that responder_id 21 exists
- Create an incident first (Test 1.1) before using report_id in dispatcher tests

**Token expired?**
- Request new tokens from the test account login endpoints
- Update the `user_token` and `dispatcher_token` variables in Postman

---

## Postman Collection (Ready to Import)

The complete Postman collection with all 18+ test requests is available in a separate file:

**📁 File:** [RBAC_POSTMAN_COLLECTION.json](RBAC_POSTMAN_COLLECTION.json)

**Import Steps:**
1. In Postman, click **Import** (top-left)
2. Select **File** tab
3. Choose `RBAC_POSTMAN_COLLECTION.json`
4. Click **Import**
5. The collection includes pre-configured variables:
   - `base_url`: http://localhost:3000/api
   - `user_token`: (pre-filled with valid token)
   - `dispatcher_token`: (pre-filled with valid token)
   - `admin_token`: (empty - request from admin)
   - `report_id`: 500 (update after Test 1.1)
   - `user_id`: 91
   - `responder_id`: 21

**Running Tests:**
- Click on a request
- Click **Send**
- Check Response status and body
- Move to next test

---

## Next Steps

After completing all tests:

1. **Verify all scenarios pass** - Check each test matches expected response
2. **Review permission matrix** - Ensure role restrictions are as expected
3. **Test with your own data** - Create additional incidents and dispatches
4. **Document results** - Screenshot passing tests for validation
5. **Request admin token** - Ask system administrator for admin token to complete admin tests

---

**Last Updated:** February 19, 2026  
**Test Accounts Status:** Active  
**Token Expiry:** February 19, 2026
