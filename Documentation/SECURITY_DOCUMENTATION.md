# RescueLink Security Documentation

## Multi-Layered Security Architecture

RescueLink implements five complementary layers of security controls to protect emergency incident data, user privacy, and system integrity:

### Layer 1 – Authentication & Session Security

Ensures only legitimate users can access the system with verified identities and secure session management.

### Layer 2 – Authorization & Access Control

Enforces role-based access control (RBAC) and ownership protection so users can only access resources appropriate to their role and permissions.

### Layer 3 – Data Protection & Encryption

Protects sensitive data in transit (HTTPS/TLS) and at rest (encrypted fields, file encryption).

### Layer 4 – Input Validation & Injection Prevention

Validates all user inputs against strict rules to block malformed or malicious data before it enters the database.

### Layer 5 – Upload Scanning & Monitoring

Scans uploaded files for malware and security threats; maintains audit trails for forensic analysis and compliance.

---

## Layer 1: Authentication & Session Security

### Phone Number Based Registration (Mobile Users)

Mobile users self-register using phone number verification:

1. **Phone Registration Initiation**:
   - User submits phone number via mobile app
   - System generates OTP (One-Time Password) and sends via SMS
   - OTP is valid for 15 minutes and single-use only
   - Rate limited to 3 OTP requests per phone number per hour

2. **Firebase Phone Verification**:
   - User enters OTP; app verifies locally with Firebase
   - Firebase returns authentication token after successful verification
   - User completes registration form: first name, last name, email, password
   - Password must meet policy: minimum 12 characters, uppercase, lowercase, number, special character

3. **Password Security**:
   - Passwords hashed with bcrypt (cost factor: 12)
   - Salted during hashing; unique salt per password
   - Original password never transmitted or stored
   - Comparison uses constant-time algorithm (prevent timing attacks)

4. **Token Lifecycle**:
   - After successful registration/login, system returns JWT bearer token
   - Token valid for 7 days from issuance
   - JWT structure: `header.payload.signature`
   - No refresh token (explicit re-login on expiry for security)
   - Token includes user_id, email, phone, role, and exp claim
   - Invalid/expired tokens return `401 Unauthorized`

### Dispatcher Account Creation & Multi-Factor Authentication

Dispatcher accounts are created by administrators with enhanced security:

1. **Account Creation**:
   - Admin creates dispatcher account with email and assigns role
   - System generates temporary password and sends to dispatcher email
   - Dispatcher must change temporary password on first login
   - New password must meet same policy as mobile users

2. **Optional OTP-Based MFA**:
   - When enabled, dispatcher login flows through additional step
   - After email/password verification, system generates 6-digit OTP
   - OTP sent via SMS to dispatcher's registered phone
   - OTP valid for 5 minutes, single use
   - Token issued only after successful OTP verification
   - Prevents account takeover even if password is compromised

3. **Session Tokens**:
   - Before MFA verification complete, system returns session token (not bearer token)
   - Session token is temporary and only valid for OTP verification endpoint
   - Session tokens are not logged or audited; only final bearer tokens are
   - Session tokens expire immediately after OTP verification or timeout

### Logout & Token Blacklisting

Logout is an explicit operation during which the token is invalidated:

1. **Logout Operation**:
   - Client sends `POST /api/auth/logout` with bearer token
   - Server adds token to in-memory blacklist immediately
   - Blacklist entries expire after token's original expiration time
   - Subsequent uses of token return `401 Unauthorized`

2. **Token Refresh Constraints**:
   - No automatic refresh mechanism (forces re-authentication)
   - If token is lost/stolen, adversary has limited window (7 days max)
   - User can proactively logout to immediately revoke token

### Password Reset Flow

Secure password reset protects against unauthorized account takeover:

1. **Reset Request**:
   - User submits email/phone via forgot-password endpoint
   - System verifies account exists and user owns the account
   - System generates secure reset token (random 32-byte string, URL-safe base64)
   - Reset token valid for 2 hours only
   - Reset token sent via email with reset link

2. **Reset Completion**:
   - User clicks email link (includes token as URL parameter)
   - User submits new password that meets security policy
   - System validates token hasn't expired and hasn't been used before
   - System updates password with new bcrypt hash
   - Uses per-user audit log so admin can see password change activity

### Session Security Practices

- **HTTPS Only**: All authentication flows use TLS 1.2 or higher; HTTP redirects to HTTPS
- **Secure Cookies**: If cookies used, marked `HttpOnly` (no JavaScript access) and `Secure` (HTTPS only)
- **CORS Protection**: Cross-Origin requests validated; frontend must be whitelisted
- **Clickjacking Protection**: `X-Frame-Options: DENY` header set on all responses
- **Content Security Policy**: Strict CSP headers prevent injection of external scripts

---

## Layer 2: Authorization & Access Control

### Role-Based Permission Matrix

RescueLink enforces granular permissions per role across all resources:

**User Role (Mobile Reporters)**
| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| Own Incidents | ✓ | ✓ | ✓ (limited) | — | Can only update status to mark resolved |
| Own Notifications | — | ✓ | ✓ (mark read) | ✓ | Cannot delete notifications, only hide |
| Other Users' Incidents | — | — | — | — | Strictly forbidden |
| Responders/Teams | — | — | — | — | No visibility |
| Admin Functions | — | — | — | — | No access |

**Dispatcher Role (Emergency Coordinators)**
| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| All Incidents | — | ✓ | ✓ (status, classification) | — | Full visibility and operational control |
| Dispatch Assignments | ✓ | ✓ | ✓ | ✓ | Core operational function |
| Responder Teams | ✓ | ✓ | ✓ | — | Limited management |
| Departments | — | ✓ | — | — | Read-only view |
| Notifications | ✓ | ✓ | — | — | Can trigger alerts |
| User Management | — | — | — | — | No direct user edit access |

**Admin Role (System Administrators)**
| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| All Resources | ✓ | ✓ | ✓ | ✓ | Unrestricted access to entire system |
| User Management | ✓ | ✓ | ✓ | ✓ | Create, modify, deactivate users |
| Role Assignment | — | ✓ | ✓ | — | Can promote user to any role |
| System Config | ✓ | ✓ | ✓ | — | Configure security policies, limits |
| Audit Logs | — | ✓ | — | — | Read-only access to all audit trails |

**Supervisor Role (Team Leaders)**
| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| All Incidents | — | ✓ | — | — | Full transparency |
| Team Members | — | ✓ | — | — | Management of assigned team |
| Department Operations | — | ✓ | ✓ | — | Schedule and coordinate operations |
| Responders | ✓ | ✓ | ✓ | — | Limited personnel management |

**Responder Role (Emergency Personnel)**
| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| Assigned Incidents | — | ✓ | — | — | Only incidents they're assigned to |
| Own Status | — | ✓ | ✓ | — | Update availability (available/busy/off-duty) |
| Team Notifications | — | ✓ | — | — | Dispatch notifications for team |

**Department Admin Role (Department Heads)**
| Resource | Create | Read | Update | Delete | Notes |
|----------|--------|------|--------|--------|-------|
| Department Resources | ✓ | ✓ | ✓ | ✓ | Full control of own department |
| Own Department Incidents | — | ✓ | — | — | Operations visibility |
| Cross-Department | — | — | — | — | No access to other departments |

### Ownership Protection Enforcement

Access to user-specific resources is enforced at multiple levels:

**Incident Ownership:**

- User can only view incidents they created
- User can only update their own incidents
- Download endpoints (audio, media) check ownership before streaming
- Exception: Dispatchers and admins bypass ownership and see all incidents

**Notification Ownership:**

- User receives only their own notifications
- Server-side validation prevents accessing other users' notifications even with ID
- Attempting unauthorized access returns `403 Forbidden`
- Exception: Admins can query all notifications for audit purposes

**Resource Cleanup:**

- When user account is deleted, system either deletes or archives associated incidents
- Policy: Incidents become "anonymous" (delete personal info but keep incident record for analytics)
- Notifications are deleted when user account is deleted

---

## Layer 3: Data Protection & Encryption

### HTTPS/TLS Requirements

All network communication is encrypted:

- **Minimum TLS Version**: TLS 1.2
- **Cipher Suites**: Only strong ciphers enabled (AES-GCM, ChaCha20-Poly1305)
- **Certificate Validation**: All clients validate server certificate
- **HSTS (HTTP Strict Transport Security)**: Enabled to force HTTPS on all requests
- **Forward Secrecy**: Ephemeral key exchange (ECDHE) for session security
- **Certificate Pinning** (Mobile): Flutter app pins expected certificate to prevent MITM attacks

### File Encryption At Rest

Uploaded incident files and audio recordings are encrypted when stored on disk:

- **Algorithm**: AES-256 GCM (Galois/Counter Mode)
- **Key Storage**: Symmetric encryption key stored in environment variable (`ENCRYPTION_KEY`)
- **Per-File IV**: Random Initialization Vector generated per file
- **Authentication Tags**: GCM mode provides authenticated encryption (detects tampering)
- **Quarantine Folder**: Quarantined files stored in encrypted directory; key same as normal files
- **Backup**: If backups used, same encryption applies to backup storage

### Sensitive Field Encryption

Certain database fields are encrypted at rest:

- **Phone Numbers**: Encrypted before storage; decrypted only for authorized operations
- **Email Addresses**: Encrypted to prevent unauthorized data exposure
- **Location History**: Historical coordinates encrypted; current location may be decrypted for operational use
- **Emergency Contact Info**: All contact fields encrypted for user safety
- **Encryption Key Rotation**: Keys rotated annually; old records re-encrypted with new key

### Password Hashing

Passwords never stored in plaintext; exclusively bcrypt hashed:

```
bcrypt configuration:
- Algorithm: bcrypt (automatically includes salt)
- Cost Factor: 12 (takes ~250ms to verify on modern hardware)
- Salt: Unique per password (bcrypt handles automatically)
- Output: 60-character hash string stored in database
```

**Password Comparison Process:**

1. User submits plaintext password
2. System retrieves stored bcrypt hash
3. Constant-time comparison: bcrypt verifies plaintext against hash
4. Timing attack prevention: hash verification time consistent whether match or mismatch
5. Result is boolean (match/no match); never reveals partial information

---

## Layer 4: Input Validation & Injection Prevention

### Validation Rules by Field Type

**Email Validation:**

- Pattern: RFC 5322 compliant regex (with practical constraints)
- Length: 5-255 characters
- Forbidden characters: None if pattern passes
- Testing: `test@example.com` ✓, `invalid..email@test.com` ✗
- Normalization: Converted to lowercase; leading/trailing spaces stripped
- Uniqueness: Database enforces unique constraint; duplicate attempts blocked

**Phone Number Validation:**

- Format: International format with country code
- Length: 10-20 characters (supports multiple country formats)
- Pattern: `^\\+?[1-9]\\d{1,14}$` (E.164 format when possible)
- Testing: `+1234567890` ✓, `555-1234` ✗ (missing country code)
- Normalization: Spaces and dashes removed; country code added if missing
- Duplicate prevention: While phone-based auth allows registration, subsequent usage may be tracked

**Password Validation:**

- Minimum length: 12 characters
- Required character types:
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 digit (0-9)
  - At least 1 special character (!@#$%^&\*)
- Common password check: Compared against list of 100,000+ common passwords; rejected if match
- Constraint: Cannot be same as previous 3 passwords (prevents cycling)
- Test: `Pass123!Test` ✓, `admin123` ✗ (no uppercase, special char)

**Incident Type Validation:**

- Allowed values: Enumeration of ~15 incident types
- Examples: `fire`, `medical_emergency`, `traffic_accident`, `fire_hazard`, `flooding`, `crime_report`, `missing_person`
- Validation: Exact match required; typos rejected
- Error response: `400 Bad Request` with allowed values listed

**Severity Level Validation:**

- Allowed values: `low`, `medium`, `high`, `critical`
- Enumeration validated before storage
- Invalid values rejected with `400 Bad Request`

**Coordinate Validation (Geolocation):**

- Latitude: Decimal number from -90 to 90
- Longitude: Decimal number from -180 to 180
- Precision: At least 6 decimal places (1M accuracy)
- Boundary check: Coordinates must be within operational area (Dagupan City bounds)
- Format: Parsed as float; integer strings also accepted
- Test: `16.0433` (lat), `120.7275` (lon) ✓, `16.99` (outside city) ✗

**Text Input Validation (Descriptions, Notes):**

- Maximum length: 2000 characters
- Character set: Allowed characters are printable Unicode (prevents control characters)
- HTML/Script Injection Prevention:
  - No `<`, `>`, `{`, `}` characters (blocks HTML/template injection)
  - No JavaScript keywords: `script`, `onclick`, `onerror`, `eval` (case-insensitive)
  - If detected, input rejected with descriptive error
- Normalization: Whitespace trimmed; newlines normalized to space

### SQL Injection Prevention

- **Parameterized Queries**: All database queries use prepared statements with placeholders
- **ORM Layer**: Sequelize ORM used with query parameterization automatically applied
- **Never String Concatenation**: Dynamic SQL never constructed from unsanitized user input
- **Audit**: Code review checklist includes "no string concatenation in SQL queries"
- **Testing**: Quarterly penetration testing includes SQL injection attempts on all endpoints

### NoSQL/MongoDB Injection Prevention

- If MongoDB used, operator whitelisting applied
- Query structure validation ensures operators like `$where`, `$eval` cannot be injected
- Example: User input `{ "$gt": "" }` correctly parsed and sanitized before use

### XSS (Cross-Site Scripting) Prevention

- **Output Encoding**: All user-provided data HTML-encoded before rendering in web frontend
- **React Escaping**: React framework automatically escapes content (prevents inline script injection)
- **No dangerouslySetInnerHTML**: Developers forbidden from using React's `dangerouslySetInnerHTML`
- **Content Security Policy (CSP)**: Strict policy loaded from server; no inline scripts allowed
- **Cookie HttpOnly Flag**: Bearer tokens stored in `HttpOnly` cookies (inaccessible to JavaScript)

---

## Layer 5: Upload Security & Scanning

### File Upload Workflow

Emergency incident uploads follow a two-stage scanning process for maximum security:

**Stage 1 – Quick Signature Scan (Immediate):**

1. User uploads file (audio, photo, video) via API
2. System checks file size:
   - Audio: Max 50 MB per file
   - Photos: Max 10 MB per file
   - Videos: Max 100 MB per file
   - Rejected if exceeded; returns `413 Payload Too Large`
3. System reads first 4 MB, computes SHA-256 hash
4. Hash checked against blocklist (malware signatures, known compromised files)
5. File magic bytes verified (actual file type matches reported extension)
   - Example: File claims to be `.mp3` but magic bytes identify as executable; rejected
6. Quick scan decision:
   - **Approved**: File physically stored in upload folder; incident proceeds normally
   - **Blocked**: File deleted immediately; incident creation aborted; error returned to client
7. Once approved, incident created and audio processing begins

**Stage 2 – Deep Scan (Background):**

1. File enqueued for asynchronous scanning (doesn't block user workflow)
2. System calls external scanner service (e.g., VirusTotal, ClamAV enterprise)
3. Deep scan policies:
   - **Maximum wait time**: 2 hours; if not complete by then, assume clean
   - **Retry strategy**: Up to 3 attempts; if all fail, assume clean (fail-open)
   - **Concurrency**: Single dedicated worker processes one file at a time (prevents resource exhaustion)
4. Deep scan results stored in database
5. If **threat detected**:
   - File immediately placed in quarantine folder
   - Incident marked as quarantined
   - Dispatch notification withheld from responders
   - Admin alert generated
   - Entry created in audit log with actor (scanner service)
6. If **clean** or **timeout**:
   - File remains accessible
   - Previously withheld dispatch notifications released to responders
   - Status updated in audit log

### Quarantine & Recovery Procedures

**Quarantine Action:**

- Quarantined files stored in separate encrypted directory (`/uploads/_quarantine/`)
- Database record includes quarantine timestamp and reason
- Users cannot download quarantined files (API returns error)
- Download endpoint checks file location; returns `403 Forbidden` if in quarantine

**Admin Recovery Options:**

1. **Release File** (Trust Decision):
   - Admin reviews threat assessment in admin panel
   - Admin clicks "Release" button with optional note
   - File moved back to normal uploads folder
   - Incident status updated; notifications released to responders
   - Audit log entry: `admin_released_quarantine`, `actor_id`, `reason` (admin's note)

2. **Delete File Permanently**:
   - Admin clicks "Delete" button
   - File physically deleted from disk
   - Incident marked as "evidence_unavailable"
   - Audit log entry: `admin_deleted_quarantine`, `actor_id`
   - Users/responders cannot access file; API returns `409 Conflict`

3. **Download For Analysis**:
   - Admin chooses "Download For Review"
   - File streamed securely to admin's computer (HTTPS only)
   - Access logged in audit trail with timestamp
   - Downloads limited to admin role only

### Fail-Open Policy

If scanning service becomes unavailable:

- Quick signature scan failures: **Block** (conservative; prevent unknown threats)
- Deep scan service unreachable: **Allow** after timeout (fail-open; keep operations running)
- Timeout default: 2 hours; if no response, assume file is acceptably clean
- Rationale: Emergency response should not be delayed by scanner unavailability; human review can handle edge cases

**Deep Scan Unavailability Scenario:**

- User reports incident 2 PM with audio recording
- Quick scan passes immediately
- Incident created, responders dispatched
- Deep scan worker tries to call external service; service returns HTTP 503 (unavailable)
- Worker retries at 2:05 PM, 2:15 PM (all fail)
- At 4 PM, timeout period expires
- File marked as "scanned_ok" (fail-open); incident proceeds normally
- If service comes back online later, retry is NOT performed (once timeout expires, no retry)

---

## Operational Security Controls

### Audit Logging

Every security-relevant operation is logged for forensic analysis and compliance:

**Logged Events:**

- User authentication (login, logout, MFA attempts, password changes)
- Authorization checks (access denied, permission changes)
- Incident creation/update/deletion
- File uploads and quarantine actions
- Admin actions (user deletion, role changes, settings modifications)
- Data exports or bulk operations
- Error conditions (validation failures, system errors)

**Audit Log Fields:**

```json
{
  "id": "audit_log_uuid",
  "timestamp": "2026-03-24T10:30:00Z",
  "actor_id": "user_123 or system_service",
  "action": "incident_created / user_login / file_quarantined",
  "resource_type": "incident / user / file",
  "resource_id": "123",
  "details": {
    "severity": "high",
    "changes": { "old_value": "...", "new_value": "..." }
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "status": "success / failed",
  "error_message": "if status=failed"
}
```

**Log Access Control:**

- Dispatchers can view only their own audit logs
- Admins can view all audit logs
- Regular users cannot access audit logs
- Log retention: Minimum 12 months; recommended 3 years
- Backup: Audit logs backed up separately (cannot be modified if original deleted)

### Rate Limiting & DDoS Protection

**Authentication Endpoint Rate Limits:**

- `POST /api/auth/login`: 10 requests per 15 minutes per account
- Consecutive failures trigger progressive delays (backoff)
- After 5 failed attempts: Account temporarily locked for 15 minutes
- Admin notified if account repeatedly attacked

**General API Rate Limit:**

- 500 requests per 15 minutes per IP address (production)
- 2000 requests per 15 minutes per IP (development)
- 429 Too Many Requests response when exceeded

**Response Headers Include:**

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 423
X-RateLimit-Reset: 1711270500
Retry-After: 45
```

### Secrets Management

Sensitive configuration stored securely:

- **Environment Variables**: Database password, JWT secret, encryption key, API keys
- **Never Committed**: `.env` file in `.gitignore`; secrets never in version control
- **Access Control**:
  - Development secrets stored locally in `.env`
  - Production secrets managed by platform secrets manager (e.g., AWS Secrets Manager)
  - Deployed applications retrieve secrets at startup
  - Secrets rotated every 90 days
- **Secret Rotation**: Old secrets kept for 24 hours to allow in-flight requests to complete
