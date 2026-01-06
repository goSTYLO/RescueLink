# RescueLink Backend (initial)

This is a minimal Node.js + Express backend scaffold using PostgreSQL.

Quick start

1. Copy the example env and edit values:

   - Copy `.env.example` to `.env` and update `DATABASE_URL` and `JWT_SECRET`.

2. Create the database and users table (example):

```sql
CREATE TABLE users (
   id SERIAL PRIMARY KEY,
   email TEXT UNIQUE,
   phone_number TEXT UNIQUE,
   first_name TEXT,
   last_name TEXT,
   password TEXT NOT NULL,
   phone_verified BOOLEAN DEFAULT false,
   created_at TIMESTAMP DEFAULT NOW()
);
```

3. Install dependencies:

   npm install

4. Start in development mode (requires nodemon):

   npm run dev

Notes
 - The project exposes the following endpoints:
      - `POST /api/auth/register` — register with phone number, firstName, lastName & password (unverified phone)
      - `POST /api/auth/login` — login with phone number & password
   - `POST /api/auth/onboard-phone` — onboard using phone verification via Firebase (see below)

- Configure `DATABASE_URL` to point to your Postgres instance.

Phone onboarding (Firebase)

The server expects the client to perform Firebase phone verification using the Firebase client SDK
to send and confirm the SMS OTP. After the client confirms the phone number, it receives a Firebase
ID token. The client should send that ID token to the backend endpoint `POST /api/auth/onboard-phone`
with a JSON body like:

```json
{
   "idToken": "<firebase id token>",
   "password": "<desired password>"
}
```

The backend verifies the ID token using the Firebase Admin SDK, extracts the verified phone number,
and creates a local user record with `phone_verified = true` and the provided password (hashed).

This approach avoids having to implement SMS sending on the server; Firebase's free quota can be used
for sending the SMS from the client-side flow. See Firebase docs for Phone Auth client integration.
