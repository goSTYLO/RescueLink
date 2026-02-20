import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import logo from '@/presentation/assets/logo.svg';
import illustration from '@/presentation/assets/create-password-illustration.svg';

const API_URL = 'http://localhost:3000';

export default function CreateNewPassword({ onSuccess, onBackToLogin }) {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (password) => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      return 'Password must contain at least one special character (@$!%*?&)';
    }
    return '';
  };

  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) {
      return 'Please confirm your password';
    }
    if (confirmPassword !== password) {
      return 'Passwords do not match';
    }
    return '';
  };

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);
    if (passwordError) {
      setPasswordError(validatePassword(value));
    }
    // Also validate confirm password if it's already filled
    if (confirmPassword) {
      setConfirmPasswordError(validateConfirmPassword(confirmPassword, value));
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmPasswordError || value) {
      setConfirmPasswordError(validateConfirmPassword(value, newPassword));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const passwordValidationError = validatePassword(newPassword);
    const confirmPasswordValidationError = validateConfirmPassword(confirmPassword, newPassword);
    
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
    }
    if (confirmPasswordValidationError) {
      setConfirmPasswordError(confirmPasswordValidationError);
    }
    
    if (passwordValidationError || confirmPasswordValidationError) {
      Swal.fire({
        icon: 'warning',
        title: 'Validation failed',
        text: passwordValidationError || confirmPasswordValidationError,
        confirmButtonColor: '#134178',
      });
      return;
    }

    setLoading(true);
    setPasswordError('');
    setConfirmPasswordError('');

    try {
      const email = sessionStorage.getItem('resetEmail');
      
      // TODO: Replace with actual API endpoint
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      // Clear stored email
      sessionStorage.removeItem('resetEmail');
      
      Swal.fire({
        icon: 'success',
        title: 'Password reset!',
        text: 'Your password has been updated. Redirecting to login...',
        confirmButtonColor: '#134178',
      }).then(() => navigate('/login'));
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Reset failed',
        text: err.message || 'Failed to reset password. Please try again.',
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
          <h2 className="text-4xl font-bold text-gray-800 mb-3 transition-all duration-300">Reset Password</h2>
          <p className="text-lg text-gray-600">
            Create a new password for your account.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter a new password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                onBlur={() => setPasswordError(validatePassword(newPassword))}
                className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 ${
                  passwordError 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors duration-300"
              >
                {showNewPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {passwordError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600 animate-fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{passwordError}</span>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                onBlur={() => setConfirmPasswordError(validateConfirmPassword(confirmPassword, newPassword))}
                className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 ${
                  confirmPasswordError 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors duration-300"
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPasswordError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600 animate-fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{confirmPasswordError}</span>
              </div>
            )}
          </div>

          {/* Reset Password Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF4F52] text-white py-3 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:bg-gray-400 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-gray-500/30"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
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
              alt="Create New Password Illustration" 
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
          <p className="text-gray-600 text-sm mb-4">Create a secure password</p>
          {/* Pagination Dots */}
          <div className="flex gap-2 justify-center">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          </div>
        </div>
      </div>

    </div>
  );
}
