# Encryption Testing with Postman – Complete Guide

> **Test RescueLink's field-level encryption (AES-256-GCM) to verify that sensitive data is encrypted in the database but returned decrypted via API (transparent encryption).**

---

## 🎯 Quick Start

### 1. **Import the Collection**
- Open **Postman**
- Click **Import** → **Upload Files**
- Select `Backend/ENCRYPTION_POSTMAN_COLLECTION.json`
- Collection loads with 20+ pre-configured test requests

### 2. **Set Environment Variables**
- Open the **Environment** dropdown at top-right
- Create new environment named **"RescueLink Encryption"**
- Add these variables:
  ```
  baseUrl: http://localhost:3000
  userToken: (auto-filled by login request)
  dispatcherToken: (auto-filled by login request)
  userId: 91
  dispatcherId: 92
  ```

### 3. **Run the Tests**
- Start with **Section 1: Base Setup** (fills in login tokens)
- Then run **Sections 2–5** to test all encrypted fields
- Close with **Section 6: Summary** for verification report

---

## 📋 Collection Overview

### **Test Accounts** (Pre-created in Database)
| Role | Login | Password | ID |
|------|-------|----------|-----|
| **User** | +639666638967 | SecurePass123! | 91 |
| **Dispatcher** | aabe.tamayo.up@phinmaed.com | SecurePass123! | 92 |

### **Encrypted Fields** (16 Total)
| Model | Encrypted Fields |
|-------|------------------|
| **User** | phone_number, email, first_name, last_name, address |
| **Incident** | latitude, longitude, description, transcription, audio_path, media_url, media_paths |
| **Responder** | contact_number, name |
| **AuditLog** | ip_address, details |

### **Encryption Details**
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **IV**: 12 bytes (unique for each encryption)
- **Auth Tag**: 16 bytes (integrity verification)
- **Storage**: Hex string format in database

---

## 🧪 Section-by-Section Guide

### **1. Base Setup** (2 requests)
Login with test accounts to get JWT tokens (auto-saved to environment variables)

```
1.1 Login as User
   → POST /api/auth/login
   → Credentials: +639666638967 / SecurePass123!
   → Sets: {{userToken}}

1.2 Login as Dispatcher
   → POST /api/auth/dispatcher/login
   → Credentials: aabe.tamayo.up@phinmaed.com / SecurePass123!
   → Sets: {{dispatcherToken}}
```

**Expected:** Both return `200 OK` with JWT token in response

---

### **2. User Data Encryption Tests** (3 requests)
Test that PII (phone, email, name, address) is encrypted in DB but decrypted in API

```
2.1 Get User Profile (Check Decryption)
   → GET /api/auth/me (as regular user)
   
   ✅ Test: API returns DECRYPTED values
   • phone_number: +639666638967 (readable, not hex)
   • email: user@example.com (readable, not hex)
   • first_name, last_name, address: all readable strings
   
   🔐 Meaning: Model automatically decrypts on retrieval

2.2 Get User as Admin (Verify Decryption)
   → GET /api/admin/users/91 (as dispatcher/admin)
   
   ✅ Test: Admin endpoint also returns DECRYPTED data
   • Same PII fields are readable
   
   🔐 Meaning: Decryption happens consistently across all endpoints

2.3 SQL Check: View Encrypted Data
   → Reference request (no API call)
   
   🔐 Instructions to run PostgreSQL query:
   SELECT phone_number, email FROM users WHERE id = 91;
   
   Expected: Hex strings like "4a7f9e2c1b5d3a8f..."
   This verifies DATABASE STORAGE is encrypted
```

**Key Insight**: Compare API response (readable) with SQL output (encrypted hex)

---

### **3. Incident Encryption Tests** (4 requests)
Test that location data (coordinates, description) is encrypted in DB but decrypted in API

```
3.1 Create Emergency Incident
   → POST /api/incidents/emergency
   → Coordinates: 14.5995, 120.9842
   
   ✅ Test: API returns NUMBERS (not strings/hex)
   • latitude: 14.5995 (type: number, decrypted)
   • longitude: 120.9842 (type: number, decrypted)
   • description: "Traffic accident on EDSA" (readable)
   
   🔐 Meaning: Coordinates stored as encrypted hex,
           but model converts back to numbers on retrieval

3.2 Get Incident (Verify Coordinate Decryption)
   → GET /api/incidents/{{incidentId}}
   
   ✅ Test: Coordinates are valid geographic ranges
   • latitude: -90 to 90
   • longitude: -180 to 180
   
   🔐 Meaning: Decryption + type conversion working

3.3 List Incidents (All Decrypted)
   → GET /api/incidents?limit=10
   
   ✅ Test: All incidents in array have decrypted coordinates
   • Each incident: latitude/longitude are numbers
   
   🔐 Meaning: Batch decryption working for list queries

3.4 SQL Check: View Encrypted Coordinates
   → Reference request (no API call)
   
   🔐 Instructions for PostgreSQL:
   SELECT latitude, longitude, description 
   FROM incident_reports ORDER BY id DESC LIMIT 5;
   
   Expected: Hex strings for all three fields
   This verifies CRITICAL LOCATION DATA is encrypted at rest
```

**Key Insight**: API: coordinates are numbers. Database: coordinates are hex encrypted.

---

### **4. Responder Encryption Tests** (2 requests)
Test that responder contact details are encrypted in DB but decrypted in API

```
4.1 Get Responder (Check Contact Decryption)
   → GET /api/responders/21
   
   ✅ Test: Contact information is readable
   • contact_number: +639123456789 (matches pattern)
   • name: readable string
   
   🔐 Meaning: Model decrypts responder contacts on retrieval

4.2 List Responders (All Decrypted)
   → GET /api/responders
   
   ✅ Test: All responders have decrypted contact info
   
   🔐 Meaning: Batch decryption in list queries
```

---

### **5. Audit Log Encryption Tests** (2 requests)
Test that audit logs (IP addresses, details) are encrypted in DB but decrypted in API

```
5.1 Get Audit Logs (Check IP Decryption)
   → GET /api/audit-logs?limit=5
   
   ✅ Test: IP addresses in valid format
   • ip_address: matches IPv4 pattern (192.168.1.1)
   • details: readable action description
   
   🔐 Meaning: Model decrypts audit trail on retrieval

5.2 SQL Check: View Encrypted IPs
   → Reference request (no API call)
   
   🔐 Instructions for PostgreSQL:
   SELECT ip_address, details FROM dispatcher_audit_logs 
   ORDER BY id DESC LIMIT 5;
   
   Expected: Hex strings for both fields
   This verifies AUDIT TRAIL is encrypted to prevent tampering
```

---

### **6. Summary & Verification** (1 request)
Display comprehensive encryption verification report

```
6.1 Encryption Summary
   → GET /api/health (triggers console output)
   
   📊 Output:
   • Lists all 16 encrypted fields
   • Shows encryption algorithm details
   • Confirms transparent encryption working
   • Instructions for manual SQL verification
```

---

## 🔐 Understanding Transparent Encryption

### **The Flow**
```
Frontend sends:  {"latitude": 14.5995}
                        ↓
Database stores: {"latitude": "4a7f9e2c1b5d3a8f..."} ← HEX ENCRYPTED
                        ↓
Model decrypts:  {"latitude": 14.5995} ← BACK TO NUMBER
                        ↓
API returns:     {"latitude": 14.5995} ← FRONTEND SEES PLAINTEXT
```

### **Why This Matters**
1. ✅ **Database cannot read PII** – Encrypted hex strings are unreadable
2. ✅ **Frontend gets plaintext** – No decryption logic needed client-side
3. ✅ **Type preservation** – Coordinates stay as numbers (not strings)
4. ✅ **Zero-latency** – Encryption/decryption at model layer, not API layer

---

## 📊 Manual Database Verification

To prove encryption is working, verify the database directly.

### **Step 1: Connect to PostgreSQL**
```bash
psql -U postgres -d rescuelink_db
```

### **Step 2: Check Encrypted User Phone**
```sql
SELECT id, phone_number FROM users WHERE id = 91;
```

**Expected output:**
```
 id |                          phone_number
----+--------------------------------------------------------------
 91 | 4a7f9e2c1b5d3a8f7c5e2d9b1a3f5e7d4c6b8a9d1f3e5c7b9a... (hex)
```

**Contrast with API response from request 2.1:**
```json
{
  "phone_number": "+639666638967"  ← READABLE (decrypted by model)
}
```

### **Step 3: Check Encrypted Incident Coordinates**
```sql
SELECT id, latitude, longitude FROM incident_reports ORDER BY id DESC LIMIT 3;
```

**Expected output:**
```
 id |                          latitude                          |                          longitude
----+--------------------------------------------------------------+--------------------------------------------------------------
  5 | 9e2c1b5d3a8f4a7f1b5d3a8f4a7f1b5d3a8f4a7f1b5d3a8f4a... | 5d3a8f4a7f9e2c1b0a3f5c7d1a3f5e7d4c6b8a9d1f3e5c7b9a...
```

**Contrast with API response from request 3.2:**
```json
{
  "latitude": 14.5995,        ← NUMBER (decrypted & type-converted)
  "longitude": 120.9842      ← NUMBER (decrypted & type-converted)
}
```

### **Step 4: Check Encrypted Audit Log IP**
```sql
SELECT id, ip_address, details FROM dispatcher_audit_logs ORDER BY id DESC LIMIT 1;
```

**Expected output:**
```
 id |                          ip_address                          |                          details
----+--------------------------------------------------------------+--------------------------------------------------------------
  1 | 4a7f9e2c1b5d3a8f7c5e2d9b1a3f5e7d4c6b8a9d1f3e5c7b9a... | 9e2c1b5d3a8f4a7f1b5d3a8f4a7f1b5d3a8f4a7f1b5d3a8f4a...
```

**Contrast with API response from request 5.1:**
```json
{
  "ip_address": "192.168.1.1",              ← READABLE (decrypted)
  "details": "Incident created by dispatcher"  ← READABLE (decrypted)
}
```

---

## ✅ Validation Checklist

Run through this checklist after completing all tests:

- [ ] **Section 1 (Base Setup)**
  - [ ] User login returns 200 with token
  - [ ] Dispatcher login returns 200 with token
  - [ ] Tokens auto-saved to environment

- [ ] **Section 2 (User Encryption)**
  - [ ] Phone number returned readable (+639666638967)
  - [ ] Email contains @ (readable)
  - [ ] User update shows decrypted value
  - [ ] SQL query shows phone as hex (encrypted)

- [ ] **Section 3 (Incident Encryption)**
  - [ ] Coordinates returned as numbers (14.5995, 120.9842)
  - [ ] Description returned readable
  - [ ] List view shows all coordinates as numbers
  - [ ] SQL query shows coordinates as hex (encrypted)

- [ ] **Section 4 (Responder Encryption)**
  - [ ] Contact number in +63 format (readable)
  - [ ] Responder name returned readable
  - [ ] List view shows all contacts readable

- [ ] **Section 5 (Audit Log Encryption)**
  - [ ] IP addresses in IPv4 format (readable)
  - [ ] Details returned as readable text
  - [ ] SQL query shows IP and details as hex (encrypted)

- [ ] **Section 6 (Summary)**
  - [ ] Console displays complete verification report
  - [ ] All 16 encrypted fields listed
  - [ ] Algorithm details confirmed

---

## 🚀 Advanced Testing

### **Test New User Creation**
Add a request to create a new user:
```json
POST /api/admin/users
{
  "phone": "+639123456789",
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "first_name": "Jane",
  "last_name": "Doe",
  "address": "456 Oak St, Manila",
  "role": "user"
}
```

Then verify the new user is decrypted when retrieved.

### **Test Incident with Media**
Create incident with media paths (also encrypted):
```json
POST /api/incidents/emergency
{
  "latitude": 14.5995,
  "longitude": 120.9842,
  "description": "Building collapse",
  "audio_path": "/uploads/incident_123.mp3",
  "media_paths": ["photo1.jpg", "photo2.jpg"]
}
```

Verify `audio_path` and `media_paths` are returned readable.

### **Load Test**
Run 10+ concurrent requests to test encryption performance:
```javascript
// In Postman Console:
for (let i = 0; i < 10; i++) {
  pm.sendRequest({
    url: 'http://localhost:3000/api/incidents?limit=10',
    method: 'GET',
    header: {
      'Authorization': 'Bearer {{userToken}}'
    }
  });
}
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **401 Unauthorized** | Run Section 1 first to get tokens, verify token added to header |
| **404 Not Found** | Check API base URL is `http://localhost:3000` |
| **Coordinates returned as strings** | Model not decrypting – check `FIELD_TYPES` in incident model |
| **Database shows readable values** | Encryption not enabled – verify `ENCRYPTION_KEY` in `.env` |
| **Test timeouts** | Backend server not running – run `npm start` in Backend folder |

---

## 📚 Related Documentation

- [Encryption Architecture](./SECURITY_CHECKLIST_PRESENTATION_AND_TESTING.md#31-encrypted-database-field-level-encryption)
- [Encryption Utility Source](./src/utils/encryption.js)
- [Encrypted Field Helper](./src/utils/encryptedField.js)
- [Migration Script](./scripts/migrate-encryption.js)
- [Test Suite](./tests/encryption.test.js)

---

## 🎓 Summary

This Postman collection validates that RescueLink implements **transparent field-level encryption**:

✅ **16 sensitive fields encrypted** in database (phone, email, coordinates, IP, etc.)
✅ **AES-256-GCM** with PBKDF2 key derivation
✅ **Automatic decryption** at model layer
✅ **Zero API changes** – frontend receives normal plaintext/numbers
✅ **Database unreadable** – encrypted hex strings prevent data leakage

All tests pass **→** Encryption at rest is working correctly! 🔐
