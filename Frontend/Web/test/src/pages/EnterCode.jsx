import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Notification from '../components/Notification';
import logo from '../assets/logo.svg';
import illustration from '../assets/enter-code-illustration.svg';

const API_URL = 'http://localhost:3000';

export default function EnterCode({ onSuccess, onBackToLogin }) {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const inputRefs = useRef([]);

  const handleCodeChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      // Focus on the last filled input or the next empty one
      const nextEmptyIndex = newCode.findIndex((val, i) => i >= index && val === '');
      const focusIndex = nextEmptyIndex === -1 ? 5 : Math.min(nextEmptyIndex, 5);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex].focus();
      }
      return;
    }

    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setCodeError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validateCode = () => {
    const codeString = code.join('');
    if (codeString.length !== 6) {
      return 'Please enter the complete 6-digit code';
    }
    if (!/^\d{6}$/.test(codeString)) {
      return 'Code must contain only numbers';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validateCode();
    if (validationError) {
      setCodeError(validationError);
      return;
    }

    setLoading(true);
    setCodeError('');

    try {
      const email = sessionStorage.getItem('resetEmail');
      const codeString = code.join('');
      
      // TODO: Replace with actual API endpoint
      const response = await fetch(`${API_URL}/api/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeString }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code');
      }

      setNotification({ message: 'Code verified successfully!', type: 'success' });
      setTimeout(() => {
        navigate('/create-password');
      }, 1500);
    } catch (err) {
      setNotification({ message: err.message || 'Invalid code. Please try again.', type: 'error' });
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-12 py-8 max-w-2xl">
        {/* Logo */}
        <div className="mb-12">
          <img 
            src={logo} 
            alt="RescueLink Logo" 
            className="h-20 w-auto"
          />
        </div>

        {/* Main Title */}
        <div className="mb-8 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-3 transition-all duration-300">Enter Code</h2>
          <p className="text-lg text-gray-600">
            We've sent a verification code to your email. Please enter it below.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code Input Fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-4 text-center">
              Verification Code
            </label>
            <div className="flex justify-center gap-3">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 ${
                    codeError 
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                />
              ))}
            </div>
            {codeError && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-red-600 animate-fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{codeError}</span>
              </div>
            )}
          </div>

          {/* Verify Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF4F52] text-white py-3 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:bg-gray-400 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl hover:shadow-gray-500/30"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        {/* Resend Code */}
        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-[#FF4F52] hover:text-gray-800 font-medium transition-colors duration-300 underline underline-offset-2"
            onClick={() => {
              // TODO: Implement resend code functionality
              setNotification({ message: 'Code resent to your email.', type: 'success' });
            }}
          >
            Didn't receive the code? Resend
          </button>
        </div>

        {/* Back to Login */}
        <div className="mt-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-sm text-gray-600">or back to login</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-12 h-12 bg-[#FF4F52] rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-300 transform hover:scale-[1.05] active:scale-[0.95] shadow-md hover:shadow-lg"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Illustration */}
      <div className="flex-1 bg-[rgba(249,13,17,0.04)] flex flex-col items-center justify-center px-12 py-8 relative overflow-hidden rounded-l-3xl">
        {/* Vector Illustration */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full">
          {illustration ? (
            <img 
              src={illustration} 
              alt="Enter Code Illustration" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center text-gray-400">
              <p className="text-sm">Illustration will be added here</p>
            </div>
          )}
        </div>

        {/* Footer Text */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-gray-600 text-sm">
            For security reasons, password reset links expire after a limited time.
          </p>
          {/* Pagination Dots */}
          <div className="flex gap-2 justify-center mt-4">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
