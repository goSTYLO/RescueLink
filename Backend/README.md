# RescueLink Backend

Node.js + Express backend for RescueLink, using PostgreSQL. Handles authentication, incident reporting, dispatcher workflows, AI-powered incident classification, and audit logging.

**Security Features:**
- 🔐 **Field-level encryption (AES-256-GCM)** for sensitive PII data at rest
- 🔑 **Bcrypt password hashing** with configurable salt rounds
- 🛡️ **Role-Based Access Control (RBAC)** with 3 roles and granular permissions
- 📝 **Comprehensive audit logging** for all dispatcher actions
- 🔒 **JWT authentication** with token blacklisting for secure logout
- 🔐 **Multi-Factor Authentication (MFA)** via email OTP for dispatchers

## Quick start

1. **Copy environment file and configure:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set at minimum:
   - `DATABASE_URL` – PostgreSQL connection string
   - `JWT_SECRET` – Secure random string (32+ chars). Generate with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

2. **Create the database and run schema:**
   ```bash
   npm run setup-db
   ```
   Or manually run `schema.sql` via your DB client.

3. **Run migrations** (for existing databases):
   ```bash
   # Core migrations
   psql $DATABASE_URL -f migrations/add_dispatcher_audit_logs.sql
   psql $DATABASE_URL -f migrations/add_token_blacklist.sql
   psql $DATABASE_URL -f migrations/add_dispatcher_login_otp.sql
   psql $DATABASE_URL -f migrations/add_rbac_system.sql
   
   # Encryption migrations (REQUIRED for encryption at rest)
   node run-encrypted-fields-migration.js
   # OR manually:
   # psql $DATABASE_URL -f migrations/change_coordinates_to_text_for_encryption.sql
   # psql $DATABASE_URL -f migrations/fix_encrypted_fields_varchar_to_text.sql
   # psql $DATABASE_URL -f migrations/fix_audit_logs_details_to_text.sql
   ```
   Run other migrations in `migrations/` as needed for your schema version.

4. **Install dependencies and start:**
   ```bash
   npm install
   npm run dev
   ```

## Environment variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWTs (32+ chars in production) | Yes |
| `SALT_ROUNDS` | bcrypt salt rounds (default: 10) | No |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | `production` or `development` | Yes in production |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON | For phone auth |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP for password reset emails | For dispatcher forgot-password |
| `FRONTEND_URL` | Base URL for password reset links | For dispatcher web app |
| `BLOCKCHAIN_SERVICE_URL` | Blockchain verification service URL | For incident verification |
| `DISPATCHER_MFA_ENABLED` | Enable email OTP for dispatcher login (default: true). Set `false` for dev without SMTP | No |
| `UPLOAD_DIR` | Directory for incident uploads (default: `uploads/incidents`) | No |
| `MAX_AUDIO_SIZE` | Max audio file size in bytes (default: 25MB) | No |
| `MAX_PHOTO_SIZE` | Max photo size in bytes (default: 10MB) | No |
| `MAX_VIDEO_SIZE` | Max video size in bytes (default: 50MB) | No |
| `ENCRYPTION_KEY` | 256-bit hex key for AES-256-GCM encryption (64 hex chars). Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Yes |

For production, use a secrets manager or vault for sensitive values. Never commit `.env` to version control.

## Security Architecture

### Role-Based Access Control (RBAC)

The system implements a comprehensive RBAC system with three roles and granular permissions:

| Role | Description | Access Level |
|------|-------------|--------------|
| **USER** | Mobile app users who report incidents | Can create/read/update/delete own incidents only |
| **DISPATCHER** | Web app operators who manage dispatches | Full access to incidents, dispatches, responders, notifications |
| **ADMIN** | Super-users with full system access | All permissions + user management, system settings, disaster control |

**Permission Matrix:**
- **Users**: `create`, `readOwn`, `updateOwn`, `deleteOwn` on own incidents
- **Dispatchers**: `create`, `read`, `update`, `delete`, `list`, `manage` on incidents, dispatches, responders, notifications
- **Admins**: `manage` (full access) on all resources + user management + audit log read access

RBAC enforcement:
- Middleware: `src/middleware/rbac.js` - `authorize([ROLES.DISPATCHER, ROLES.ADMIN])`
- Configuration: `src/config/roles.js` - Role definitions and permissions
- Routes: Per-route authorization based on role requirements

### Encryption at Rest

**Field-Level Encryption (AES-256-GCM):**

All sensitive PII data is encrypted at rest using AES-256-GCM with authenticated encryption. Each encrypted value includes:
- Random 96-bit IV (Initialization Vector)
- 128-bit authentication tag for integrity verification
- PBKDF2-derived key (100,000 iterations, SHA-256)

**Encrypted Fields (16 total across 4 models):**

| Model | Encrypted Fields | Format |
|-------|------------------|--------|
| **Users** (5) | `phone_number`, `email`, `first_name`, `last_name`, `address` | TEXT (hex, 190-270 chars) |
| **Responders** (2) | `name`, `contact_number` | TEXT (hex, 190-210 chars) |
| **Incidents** (7) | `latitude`, `longitude`, `description`, `transcription`, `audio_path`, `media_url`, `media_paths` | TEXT (hex, 190-340 chars) |
| **Audit Logs** (2) | `ip_address`, `details` | TEXT (hex, 190-340 chars) |

**Important:** Passwords use **bcrypt hashing** (one-way), NOT encryption.

**How it works:**
1. **Encryption:** `src/utils/encryptedField.js` - Transparent encryption before database writes
2. **Decryption:** Automatic decryption on read operations in model layer
3. **Storage:** All encrypted fields stored as TEXT columns containing hex-encoded ciphertext
4. **Type Conversion:** Decrypted values automatically converted to original types (string/number/json)

**Migration:** If upgrading from non-encrypted schema, run:
```bash
psql $DATABASE_URL -f migrations/change_coordinates_to_text_for_encryption.sql
psql $DATABASE_URL -f migrations/fix_encrypted_fields_varchar_to_text.sql
psql $DATABASE_URL -f migrations/fix_audit_logs_details_to_text.sql
```

### Password Security

- **Algorithm:** bcrypt with configurable salt rounds (default: 10, configurable via `SALT_ROUNDS`)
- **Storage:** One-way hashed (NOT encrypted or reversible)
- **Verification:** `bcrypt.compare()` for login authentication
- **Minimum Requirements:** 8+ characters (enforced by validation middleware)
- **Implementation:** `src/utils/hash.js`

For production, use `SALT_ROUNDS=12` or higher (balance security vs. performance).

## Authentication

### User Registration & Login (Mobile)
- **Register:** `POST /api/auth/register` - Phone + password + firstName + lastName
  - Phone, email, names, and address are **encrypted** before storage
  - Password is **hashed** with bcrypt (NOT encrypted)
  - Optional geolocation validation (Dagupan City bounds)
- **Login:** `POST /api/auth/login` - Phone + password
  - Returns JWT token valid for 7 days
  - User lookup requires decrypting all phone_number fields (no direct queries possible)
- **Phone Verification:** `POST /api/auth/onboard-phone` - Firebase ID token
  - Marks phone as verified after Firebase Phone Auth

### Dispatcher Registration & Login (Web)
- **Signup:** `POST /api/auth/dispatcher/signup` - Email + password + firstName + lastName
  - Creates dispatcher account (role: `dispatcher`)
  - Logs action to `dispatcher_audit_logs`
- **Login:** `POST /api/auth/dispatcher/login` - Email + password
  - **MFA Enabled** (default): Returns `sessionToken`, sends 6-digit OTP to email
    - Complete with `POST /api/auth/dispatcher/verify-otp`
  - **MFA Disabled** (`DISPATCHER_MFA_ENABLED=false`): Returns JWT directly
  - Email lookup requires decrypting all email fields
- **Forgot Password:** `POST /api/auth/forgot-password` - Email
  - Sends password reset link (JWT-based) to email
- **Reset Password:** `POST /api/auth/reset-password-with-token` - Token + newPassword

### JWT & Protected Routes
- **Header:** `Authorization: Bearer <token>`
- **Payload:** `{ user_id, email/phone, role, iat, exp }`
- **Expiry:** 7 days
- **Middleware:** `src/middleware/auth.js` - Validates and decodes JWT
- **Logout:** `POST /api/auth/logout` - Adds token to blacklist (cannot be reused)
  - Blacklisted tokens stored in `token_blacklist` table

**Note:** Encrypted email/phone fields mean lookups require full table scan + decrypt. For production scale, consider hashed identifiers or search indexes.

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full endpoint details.

## File uploads

Incident reports can include audio and media. Use `POST /api/incidents/with-audio` with `multipart/form-data`:
- `audio` – Single audio file (wav, mp3, m4a, flac), max 25MB
- `media` – Up to 5 photos/videos (jpg, png, mp4, mov, avi)

File type and size are validated server-side.

## Audit logging

Dispatcher and admin actions are automatically logged to `dispatcher_audit_logs` for compliance and security monitoring.

**Logged Actions:**
- Authentication: `dispatcher_login`, `dispatcher_signup`, `password_reset`
- User Management: `user_create`, `user_update`, `user_delete`, `users_list`
- Incident Operations: `incident_create`, `incident_update`, `incident_verify`
- Dispatches: `dispatch_create`, `dispatch_update`
- Responder Management: `responder_create`, `responder_update`

**Logged Fields:**
- `user_id` - Who performed the action
- `action` - Action type (see above)
- `resource_type` - Resource affected (user, incident, dispatch, etc.)
- `resource_id` - ID of affected resource (if applicable)
- `details` - JSON object with action details (**encrypted**)
- `ip_address` - Client IP (**encrypted**)
- `user_agent` - Browser/client info
- `created_at` - Timestamp

**Encryption:** Both `ip_address` and `details` fields are encrypted at rest. When retrieved via `GET /api/audit-logs`, they are automatically decrypted.

**Access:**
- **Dispatchers:** Can read own audit logs (`GET /api/audit-logs?user_id=<own_id>`)
- **Admins:** Can read all audit logs with filtering options

**Query Parameters:**
- `user_id` - Filter by user
- `action` - Filter by action type
- `resource_type` - Filter by resource
- `from` / `to` - Date range filter (ISO 8601)
- `limit` / `offset` - Pagination (max 100 per page)

**Implementation:** `src/utils/auditLog.js` - Helper functions for logging actions

## Migrations

**Core Migrations** (for existing databases - new setups use `schema.sql`):

| File | Purpose | Status |
|------|---------|--------|
| `add_dispatcher_audit_logs.sql` | Dispatcher audit log table | Core feature |
| `add_token_blacklist.sql` | Token blacklist for logout invalidation | Core feature |
| `add_dispatcher_login_otp.sql` | Dispatcher MFA OTP table | MFA feature |
| `add_rbac_system.sql` | Role-based access control tables and permissions | **New - RBAC** |
| `add_ai_fields.sql` | AI classification fields (ai_pending, ai_attempted) | AI feature |
| `add_incident_verified.sql` | Incident verification status | Blockchain feature |
| `add_incident_barangay.sql` | Barangay field for incidents | Location feature |

**Encryption Migrations** (required for encryption at rest):

| File | Purpose | Required For |
|------|---------|--------------|
| `change_coordinates_to_text_for_encryption.sql` | Convert latitude/longitude from DOUBLE PRECISION to TEXT | Coordinate encryption |
| `fix_encrypted_fields_varchar_to_text.sql` | Convert all encrypted VARCHAR fields to TEXT (handles 200+ char hex) | All encrypted fields |
| `fix_audit_logs_details_to_text.sql` | Convert audit log details from JSONB to TEXT | Audit log encryption |

**Important:** Encryption migrations MUST be run in order:
```bash
# 1. Coordinates
psql $DATABASE_URL -f migrations/change_coordinates_to_text_for_encryption.sql

# 2. All encrypted fields (users, responders, incidents, audit logs)
psql $DATABASE_URL -f migrations/fix_encrypted_fields_varchar_to_text.sql

# 3. Audit log details (JSONB → TEXT)
psql $DATABASE_URL -f migrations/fix_audit_logs_details_to_text.sql
```

**Automated Migration:**
```bash
# Run all encryption migrations automatically
node run-encrypted-fields-migration.js
```

**Testing Migrations:**
- `run-migration.js` - Test coordinate migration
- `run-audit-rbac-fixes.js` - Test audit log + RBAC fixes
- `run-encrypted-fields-migration.js` - Test all encrypted field migrations

Run migrations in order for existing databases. New setups via `setup-db` use `schema.sql` which includes core tables with correct column types.

## Database Seeding

**Automated Seeding:**
```bash
npm run seed-db
# OR
node scripts/seed-db.js
```

**What Gets Seeded:**
- **1 Admin** - `admin@rescuelink.test` / `admin123`
- **2 Dispatchers** - `dispatcher@rescuelink.test`, `dispatcher2@rescuelink.test` / `dispatcher123`
- **15 Regular Users** - `user@rescuelink.test`, `user1@rescuelink.test`, etc. / `user123`
- **5 Responders** - Fire, Medical, Police, Red Cross, Civil Defense
- **6 Incident Reports** - Various severities and types
- **5 Dispatches** - Linking incidents to responders

**All seed data is encrypted:**
- User PII (phone, email, names, addresses)
- Responder details (name, contact)
- Incident data (coordinates, descriptions)
- Passwords are bcrypt-hashed

**Test Credentials:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rescuelink.test | admin123 |
| Dispatcher | dispatcher@rescuelink.test | dispatcher123 |
| User (phone) | 639666666666 | user123 |

**Important:** Seed script clears existing data. Use only for development/testing.

## Testing

**Test Scripts:**
```bash
# Encryption functionality tests
node test-comprehensive-encryption.js
node verify-encryption.js

# Emergency incident creation test
node test-emergency-incident.js

# Encryption compatibility test (cross-platform)
node test-encryption-compat.js

# Login flow test
node test-login.js
```

**Unit Tests:**
```bash
npm test

# Specific test suites
npm test -- encryption.test.js
npm test -- rbac.test.js
npm test -- integration.test.js
```

**Manual Testing:**
- Postman collections in root directory:
  - `ENCRYPTION_POSTMAN_COLLECTION.json` - Encryption endpoints
  - `RBAC_POSTMAN_COLLECTION.json` - RBAC authorization tests
- Import into Postman and test with live tokens
- See `ENCRYPTION_POSTMAN_GUIDE.md` and `RBAC_POSTMAN_GUIDE.md`

## Security Considerations

### Production Checklist

**Required:**
- ✅ Set `NODE_ENV=production`
- ✅ Use strong `JWT_SECRET` (32+ bytes, cryptographically random)
- ✅ Use strong `ENCRYPTION_KEY` (32 bytes, 64 hex chars, cryptographically random)
- ✅ Set `SALT_ROUNDS=12` or higher for bcrypt
- ✅ Enable `DISPATCHER_MFA_ENABLED=true` with configured SMTP
- ✅ Use HTTPS only (TLS 1.2+)
- ✅ Configure CORS for production origins
- ✅ Enable rate limiting on authentication endpoints
- ✅ Use secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- ✅ Regular database backups (includes encrypted data)
- ✅ Monitor audit logs for suspicious activity

**Encryption at Rest:**
- All PII data automatically encrypted with AES-256-GCM
- Encryption key MUST be 32 bytes (64 hex characters)
- Key rotation requires re-encryption of all data (not currently automated)
- Database backups contain encrypted data (keys stored separately)
- Decryption happens in application layer (never in database)

**Performance Notes:**
- Encrypted field lookups require full table scan + decrypt (no indexing)
- User login by email/phone: O(n) where n = number of users
- For production scale (10,000+ users), consider:
  - Hashed identifier columns for fast lookups
  - Caching strategies for frequently accessed encrypted data
  - Read replicas for decryption operations

**Key Management:**
- Store `ENCRYPTION_KEY` separately from application code
- Use different keys per environment (dev/staging/prod)
- Implement key rotation strategy (requires data migration)
- Never log or expose encryption keys
- Use HSM (Hardware Security Module) for highest security

**RBAC Best Practices:**
- Review role assignments regularly
- Use principle of least privilege
- Audit logs track all admin/dispatcher actions
- Dispatcher MFA required for production
- Regular security audits of permission matrix

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment steps and checklist.
