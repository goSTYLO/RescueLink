# 🧪 How to Test and See Console Logs

## Option 1: Run Automated Tests

### Test 1: Emergency Incident (Simplest)
```bash
cd Backend
node test-emergency-incident.js
```

**Output:**
```
✅ SUCCESS: Emergency incident created!
   latitude: 14.5995 (type: number)
   longitude: 120.9842 (type: number)
   ✅ Coordinates returned as NUMBERS (not hex strings)
   ✅ This means encryption/decryption is working!
```

### Test 2: Comprehensive Test (All Endpoints)
```bash
cd Backend
node test-comprehensive-encryption.js
```

**Output:**
```
🎯 SUMMARY - ALL TESTS PASSED ✅

📊 Encryption Status:
   ✅ Schema Migration: Complete
   ✅ Encryption/Decryption: Working
   ✅ PII Protection: Working
   ✅ Batch Operations: Working
   ✅ Type Conversion: Working
```

### Test 3: Database Verification
```bash
cd Backend
node verify-encryption.js
```

**Output:**
```
✅ ENCRYPTED: latitude is hex string
   Length: 198 characters (encrypted hex)
✅ ENCRYPTED: longitude is hex string
   Length: 200 characters (encrypted hex)

✅ Summary:
✅ Coordinates are encrypted in database
✅ Full encryption at rest working correctly!
```

---

## Option 2: Use Postman Collection

**Import:** `Backend/ENCRYPTION_POSTMAN_COLLECTION.json`

**Tests to Run:**

1. **Test 3.1 - Create Incident**
   - Endpoint: `POST /api/incidents/emergency`
   - Body: `{"latitude": 14.5995, "longitude": 120.9842}`
   - Expected: Status 201, coordinates returned as numbers

2. **Test 3.2 - Get Incident**
   - Endpoint: `GET /api/incidents/{id}`
   - Expected: Status 200, decrypted coordinates

3. **Test 3.4 - List Incidents**
   - Endpoint: `GET /api/incidents`
   - Expected: Status 200, all coordinates decrypted

---

## Option 3: Manual cURL Commands

### Create Emergency Incident
```bash
curl -X POST http://localhost:3000/api/incidents/emergency \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{
    "latitude": 14.5995,
    "longitude": 120.9842,
    "description": "Test incident"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "incident": {
    "report_id": 50,
    "latitude": 14.5995,
    "longitude": 120.9842,
    "description": "Test incident"
  }
}
```

### Get Incidents List
```bash
curl http://localhost:3000/api/incidents?limit=5 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

**Expected Response:**
```json
{
  "incidents": [
    {
      "report_id": 50,
      "latitude": 14.5995,
      "longitude": 120.9842,
      "description": "Test incident"
    }
  ]
}
```

---

## Viewing Console Logs

### Location: Backend Terminal

When you run `npm start` in the Backend directory:

```bash
cd Backend
npm start
```

**Watch for these log prefixes:**

```
🔐 [ENCRYPT]  - Field encryption starting
🔓 [DECRYPT]  - Field decryption starting  
📦 [BATCH]    - Batch operation starting
💾 [Incident] - Model operation
```

### Example Console Output

**When creating an incident:**

```
📝 [Incident.create] Received:
   Coordinates: lat=14.5995, lng=120.9842
   Description: Test incident

🔐 [ENCRYPT] Starting encryption:
   Fields: [latitude, longitude, description]
   📝 Input[latitude]:  14.5995 (type: number)
   ✅ Output[latitude]: 2e96c196c3e9... (198 hex chars - encrypted)
   📝 Input[longitude]:  120.9842 (type: number)
   ✅ Output[longitude]: eabd54621dd3... (200 hex chars - encrypted)
   📝 Input[description]:  Test incident (type: string)
   ✅ Output[description]: 9e2c1b5d... (120 hex chars - encrypted)
   [ENCRYPT] Complete

💾 [Incident.create] Inserting to database...

✅ [Incident.create] Database insert successful, decrypting for API response...

🔓 [DECRYPT] Starting decryption:
   Fields: [latitude, longitude, description]
   📊 Database[latitude]: 2e96c196c3e9... (198 hex chars)
      Status: ENCRYPTED (detected by hex pattern)
      🔑 Decrypted: 14.5995
      ✅ TypeConvert: String "14.5995" → Number 14.5995
   📊 Database[longitude]: eabd54621dd3... (200 hex chars)
      Status: ENCRYPTED (detected by hex pattern)
      🔑 Decrypted: 120.9842
      ✅ TypeConvert: String "120.9842" → Number 120.9842
   📊 Database[description]: 9e2c1b5d... (120 hex chars)
      Status: ENCRYPTED (detected by hex pattern)
      🔑 Decrypted: Test incident
      ✅ TypeConvert: Kept as string
   [DECRYPT] Complete
```

**When listing incidents (batch operation):**

```
📦 [BATCH] Decrypting 5 row(s)...
   Row 1/5:
   🔓 [DECRYPT] Starting decryption:
      Fields: [latitude, longitude, description]
      📊 Database[latitude]: 2e96c196c3e9... (198 hex chars)
         Status: ENCRYPTED (detected by hex pattern)
         🔑 Decrypted: 14.5995
         ✅ TypeConvert: String "14.5995" → Number 14.5995
      [DECRYPT] Complete
   ✅ Final[latitude]: 14.5995 (type: number)
   
   Row 2/5:
   ... (similar decryption logs)
   
📦 [BATCH] Complete
```

---

## What to Look For

### ✅ Success Indicators

1. **API Response:**
   ```
   Coordinates returned as NUMBERS:
   "latitude": 14.5995  (NOT "latitude": "4a7f9e2c1b5d...")
   ```

2. **Console Logs Show:**
   ```
   🔐 [ENCRYPT] ... encryption done
   🔓 [DECRYPT] ... decryption done
   Database[latitude]: 4a7f9e... (hex - encrypted)
   ✅ TypeConvert: Number 14.5995
   ```

3. **Database Content:**
   ```sql
   SELECT latitude FROM incident_reports LIMIT 1;
   -- Shows: 2e96c196c3e9... (long hex string)
   ```

### ❌ Failure Indicators

1. **API Returns Hex:**
   ```
   "latitude": "4a7f9e2c1b5d..."  (This is wrong!)
   ```

2. **No Console Logs:**
   ```
   (Backend terminal shows nothing about encryption)
   ```

3. **Database Error:**
   ```
   ERROR: invalid input syntax for type double precision
   ```

---

## Test Accounts

### User Account
- Phone: `+639666638967`
- Password: `SecurePass123!`
- Token (pre-generated): Already in ENCRYPTION_POSTMAN_COLLECTION.json

### Dispatcher Account
- Email: `aabe.tamayo.up@phinmaed.com`
- Password: `SecurePass123!`
- Token (pre-generated): Already in ENCRYPTION_POSTMAN_COLLECTION.json

---

## Troubleshooting

### Issue: No Console Logs Appearing

**Solution:**
```bash
# Make sure you're running npm start (not npm test)
cd Backend
npm start  # This will show console logs

# In another terminal, run a test
node test-emergency-incident.js
```

### Issue: API Returns Hex Instead of Numbers

**Solution:**
```bash
# Make sure migration was applied
node run-migration.js

# Verify database columns changed
psql -U postgres -d rescuelink_db -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name='incident_reports' 
  AND column_name IN ('latitude', 'longitude');
"
```

Output should show:
```
 column_name |     data_type
─────────────┼──────────────
 latitude    | text
 longitude   | text
```

### Issue: "ENCRYPTION_KEY not found" Error

**Solution:**
```bash
# Make sure .env file has encryption key
cat Backend/.env | grep ENCRYPTION_KEY

# Should output:
# ENCRYPTION_KEY=A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6
```

---

## What Gets Logged

### Database Layer
- Input values (plaintext/numbers)
- Encryption algorithm and status
- Encrypted hex output

### API Response Layer
- Decrypted values
- Type conversion (string → number)
- Final data type

### Batch Operations
- Number of rows
- Progress (row X/Y)
- Per-field decryption

---

## Performance Metrics

From console logs, you can see:

```
🔐 ENCRYPT] Starting encryption:
   [milliseconds to encrypt all fields]

🔓 [DECRYPT] Starting decryption:
   [milliseconds to decrypt all fields]

📦 [BATCH] Decrypting N row(s)...
   [milliseconds to decrypt N rows]
```

**Expected:**
- Single field: ~5-10ms
- Multiple fields: ~10-20ms
- Batch (10 rows): ~50-100ms

---

## Summary

You have multiple ways to verify encryption is working:

1. **Automatic Tests:** Run `test-*.js` scripts
2. **Manual Testing:** Use Postman or cURL
3. **Database Verification:** Run `verify-encryption.js`
4. **Console Logging:** Watch backend terminal during requests
5. **Response Verification:** Check API returns numbers, not hex

**All methods verify the same thing: Encryption/decryption working correctly! ✅**
