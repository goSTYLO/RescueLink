# RescueLink SMS Test UI

A simple React + Tailwind CSS application for testing Firebase phone authentication with Philippine phone numbers.

## Features

- ✅ Firebase Phone Authentication
- ✅ Philippine phone number format (+63)
- ✅ Visible reCAPTCHA verification
- ✅ OTP resend with 60-second cooldown
- ✅ Session persistence (auth state persists on reload)
- ✅ Backend integration with RescueLink API
- ✅ Sign-out functionality
- ✅ Responsive UI with Tailwind CSS

## Prerequisites

- Node.js (v18 or higher)
- Backend server running on `http://localhost:5000`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

## Usage

1. Enter a Philippine phone number (format: +63XXXXXXXXXX)
2. Complete the reCAPTCHA verification
3. Click "Send OTP" to receive a verification code
4. Enter the 6-digit OTP code
5. Click "Verify OTP" to authenticate
6. Upon success, you'll see your user information from the backend
7. Use "Sign Out" to log out and test with another number
8. If needed, use "Resend OTP" after the 60-second cooldown

## Environment Variables

- `VITE_API_URL`: Backend API URL (default: `http://localhost:5000`)

## Technologies

- React 18
- Vite
- Tailwind CSS
- Firebase Authentication
- react-phone-input-2
