import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';

const API_URL = 'http://localhost:3000';

export default function PhoneVerification({ onSuccess }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState('send-otp'); // 'send-otp' or 'verify-otp'
  const [userData, setUserData] = useState(null);
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);

  useEffect(() => {
    // Get user data from session storage
    const storedData = sessionStorage.getItem('pendingUser');
    if (storedData) {
      setUserData(JSON.parse(storedData));
    } else {
      setError('No registration data found. Please register again.');
    }
  }, []);

  useEffect(() => {
    // Initialize reCAPTCHA only when on send-otp step and userData is loaded
    if (step === 'send-otp' && userData && !window.recaptchaVerifier) {
      // Use setTimeout to ensure DOM is ready
      const timer = setTimeout(() => {
        try {
          const container = document.getElementById('recaptcha-container');
          if (!container) {
            console.error('reCAPTCHA container not found');
            return;
          }

          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'normal',
            callback: () => {
              // reCAPTCHA solved, user can proceed
              console.log('reCAPTCHA verified');
              setRecaptchaVerified(true);
            },
            'expired-callback': () => {
              setError('reCAPTCHA expired. Please try again.');
              setRecaptchaVerified(false);
            }
          });
          window.recaptchaVerifier.render().catch((err) => {
            console.error('reCAPTCHA render error:', err);
            setError('Failed to load reCAPTCHA. Please refresh the page.');
          });
        } catch (err) {
          console.error('reCAPTCHA error:', err);
          setError('Failed to initialize reCAPTCHA. Please refresh the page.');
        }
      }, 100);

      return () => clearTimeout(timer);
    }

    return () => {
      if (window.recaptchaVerifier && step !== 'send-otp') {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.error('Error clearing reCAPTCHA:', e);
        }
        window.recaptchaVerifier = null;
      }
    };
  }, [step, userData]);

  const handleSendOTP = async () => {
    if (!userData?.phone) {
      setError('Phone number not found');
      return;
    }

    if (!recaptchaVerified) {
      setError('Please complete the reCAPTCHA first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, userData.phone, appVerifier);
      window.confirmationResult = confirmationResult;
      setStep('verify-otp');
    } catch (err) {
      console.error('OTP send error:', err);
      setError(err.message || 'Failed to send OTP');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify OTP with Firebase
      const confirmationResult = window.confirmationResult;
      if (!confirmationResult) {
        throw new Error('No confirmation result found. Please request OTP again.');
      }

      const credential = await confirmationResult.confirm(otp);
      const idToken = await credential.user.getIdToken();

      // Send to backend for onboarding
      const response = await fetch(`${API_URL}/api/auth/onboard-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      // Clear stored data
      sessionStorage.removeItem('pendingUser');
      
      // Show success message
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <p className="text-red-600">No registration data found. Please register first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Phone Successfully Verified!</h1>
            <p className="text-gray-600">Redirecting to login...</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Verify Phone</h1>
            <p className="text-gray-600 mb-4">
              {step === 'send-otp' 
                ? `We'll send an OTP to ${userData.phone}` 
                : `Enter the OTP sent to ${userData.phone}`}
            </p>

            {step === 'send-otp' ? (
              <div className="space-y-4">
                <div id="recaptcha-container" className="flex justify-center mb-4"></div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength="6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest"
                  autoFocus
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('send-otp');
                    setOtp('');
                    setError('');
                    setRecaptchaVerified(false);
                  }}
                  className="w-full text-indigo-600 hover:underline text-sm"
                >
                  Resend OTP
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
