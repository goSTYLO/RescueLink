import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const API_URL = import.meta.env.VITE_API_URL;

const PhoneAuth = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userData, setUserData] = useState(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    // Listen for auth state changes (persistence)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Automatically authenticate with backend when user is signed in
        await authenticateWithBackend(currentUser);
      } else {
        setUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Initialize reCAPTCHA when component mounts
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'normal',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            setError('reCAPTCHA expired. Please try again.');
          }
        });
      } catch (err) {
        console.error('Error initializing reCAPTCHA:', err);
      }
    }
  }, []);

  useEffect(() => {
    // Countdown timer for resend OTP
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const authenticateWithBackend = async (firebaseUser) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      
      const response = await fetch(`${API_URL}/auth/phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setUserData(data.user);
        setSuccess('Successfully authenticated with RescueLink!');
        setError('');
      } else {
        setError(data.message || 'Failed to authenticate with backend');
      }
    } catch (err) {
      console.error('Backend authentication error:', err);
      setError('Failed to connect to backend server');
    }
  };

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formattedPhone = '+' + phoneNumber;
      const appVerifier = window.recaptchaVerifier;
      
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setSuccess('OTP sent successfully! Check your phone.');
      setResendCountdown(60);
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
      
      // Reset reCAPTCHA on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    if (resendCountdown > 0) return;
    
    // Reset reCAPTCHA for resend
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }

    // Reinitialize reCAPTCHA
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'normal',
      callback: () => {},
      'expired-callback': () => {
        setError('reCAPTCHA expired. Please try again.');
      }
    });

    await sendOTP();
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await confirmationResult.confirm(otp);
      setUser(result.user);
      setSuccess('Phone number verified successfully!');
      setOtp('');
      
      // Backend authentication will be handled by onAuthStateChanged
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setConfirmationResult(null);
      setPhoneNumber('');
      setOtp('');
      setSuccess('Signed out successfully');
      setError('');
      
      // Reinitialize reCAPTCHA after sign out
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: () => {},
        'expired-callback': () => {
          setError('reCAPTCHA expired. Please try again.');
        }
      });
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out');
    }
  };

  // Signed-in view
  if (user && userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Welcome to RescueLink!</h2>
            <p className="text-gray-600 mt-2">Successfully Authenticated</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">User Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium text-gray-800">{user.phoneNumber}</span>
              </div>
              {userData.id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">User ID:</span>
                  <span className="font-medium text-gray-800">{userData.id}</span>
                </div>
              )}
              {userData.verified !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Verified:</span>
                  <span className={`font-medium ${userData.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                    {userData.verified ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {userData.created_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Joined:</span>
                  <span className="font-medium text-gray-800">
                    {new Date(userData.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Sign-in view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">RescueLink SMS Test</h1>
          <p className="text-gray-600">Philippine Phone Authentication</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <PhoneInput
              country={'ph'}
              value={phoneNumber}
              onChange={setPhoneNumber}
              onlyCountries={['ph']}
              disabled={confirmationResult !== null || loading}
              inputStyle={{
                width: '100%',
                height: '48px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
              }}
              containerStyle={{
                width: '100%',
              }}
              buttonStyle={{
                borderRadius: '8px 0 0 8px',
                border: '1px solid #d1d5db',
              }}
            />
          </div>

          <div id="recaptcha-container"></div>

          {!confirmationResult ? (
            <button
              onClick={sendOTP}
              disabled={loading || !phoneNumber}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest"
                  disabled={loading}
                />
              </div>

              <button
                onClick={verifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                onClick={resendOTP}
                disabled={resendCountdown > 0 || loading}
                className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                {resendCountdown > 0 
                  ? `Resend OTP (${resendCountdown}s)` 
                  : 'Resend OTP'}
              </button>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Enter your Philippine phone number to receive an OTP</p>
        </div>
      </div>
    </div>
  );
};

export default PhoneAuth;
