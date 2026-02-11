import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import logo from '@/presentation/assets/logo.svg';
import illustration from '@/presentation/assets/forgot-password-illustration.svg';

const API_URL = 'http://localhost:3000';

export default function ForgotPassword({ onSuccess, onBackToLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email address is required';
    }
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) {
      setEmailError(validateEmail(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid email',
        text: emailValidationError,
        confirmButtonColor: '#134178',
      });
      setEmailError(emailValidationError);
      return;
    }

    setLoading(true);
    setEmailError('');

    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset link');
      }

      // Store email for next step
      sessionStorage.setItem('resetEmail', email);
      
      Swal.fire({
        icon: 'success',
        title: 'Reset link sent!',
        text: 'Check your email for instructions to reset your password.',
        confirmButtonColor: '#134178',
      }).then(() => navigate('/enter-code'));
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to send reset link',
        text: err.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
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
          <h2 className="text-4xl font-bold text-gray-800 mb-3 transition-all duration-300">Forgot Your Password?</h2>
          <p className="text-lg text-gray-600">
            Enter your registered email address and we'll send you instructions to reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Email Address
            </label>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => setEmailError(validateEmail(email))}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 ${
                emailError 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            />
            {emailError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600 animate-fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{emailError}</span>
              </div>
            )}
          </div>

          {/* Send Reset Link Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF4F52] text-white py-3 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:bg-gray-400 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl hover:shadow-gray-500/30"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

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
              alt="Forgot Password Illustration" 
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
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>

    </div>
  );
}
