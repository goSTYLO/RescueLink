import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import logo from '@/presentation/assets/logo.svg';
import illustration from '@/presentation/assets/create-password-illustration.svg';
import { API_URL } from '@/core/config/app.config';

function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
  if (!/(?=.*[@$!%*?&])/.test(password)) return 'Password must contain at least one special character (@$!%*?&)';
  return '';
}

function validateConfirmPassword(confirmPassword, password) {
  if (!confirmPassword) return 'Please confirm your password';
  if (confirmPassword !== password) return 'Passwords do not match';
  return '';
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasValidToken = token && token.trim().length > 0;

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);
    if (passwordError) setPasswordError(validatePassword(value));
    if (confirmPassword) setConfirmPasswordError(validateConfirmPassword(confirmPassword, value));
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmPasswordError || value) setConfirmPasswordError(validateConfirmPassword(value, newPassword));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const passwordValidationError = validatePassword(newPassword);
    const confirmValidationError = validateConfirmPassword(confirmPassword, newPassword);
    if (passwordValidationError) setPasswordError(passwordValidationError);
    if (confirmValidationError) setConfirmPasswordError(confirmValidationError);
    if (passwordValidationError || confirmValidationError) {
      Swal.fire({
        icon: 'warning',
        title: 'Validation failed',
        text: passwordValidationError || confirmValidationError,
        confirmButtonColor: '#134178',
      });
      return;
    }

    setLoading(true);
    setPasswordError('');
    setConfirmPasswordError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password-with-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

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

  if (!hasValidToken) {
    return (
      <div className="flex min-h-screen bg-white">
        <div className="flex-1 flex flex-col justify-center px-12 py-8 max-w-2xl">
          <div className="mb-12">
            <img src={logo} alt="RescueLink Logo" className="h-20 w-auto" />
          </div>
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold text-gray-800 mb-3">Invalid or expired link</h2>
            <p className="text-lg text-gray-600">
              This password reset link is missing or has expired. Please request a new one.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/forgot-password"
              className="inline-flex justify-center px-6 py-3 rounded-xl font-semibold bg-[#FF4F52] text-white hover:bg-gray-800 transition-all"
            >
              Request new link
            </Link>
            <Link
              to="/login"
              className="inline-flex justify-center px-6 py-3 rounded-xl font-semibold border-2 border-gray-300 text-gray-800 hover:bg-gray-50 transition-all"
            >
              Back to login
            </Link>
          </div>
        </div>
        <div className="flex-1 bg-[rgba(249,13,17,0.04)] flex items-center justify-center px-12 py-8">
          {illustration ? (
            <img src={illustration} alt="Reset password" className="w-full max-w-md object-contain" />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex-1 flex flex-col justify-center px-12 py-8 max-w-2xl">
        <div className="mb-12">
          <img src={logo} alt="RescueLink Logo" className="h-20 w-auto" />
        </div>
        <div className="mb-8 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-3 transition-all duration-300">Set new password</h2>
          <p className="text-lg text-gray-600">Create a new password for your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter a new password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                onBlur={() => setPasswordError(validatePassword(newPassword))}
                className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 ${
                  passwordError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
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
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                <span>{passwordError}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                onBlur={() => setConfirmPasswordError(validateConfirmPassword(confirmPassword, newPassword))}
                className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 ${
                  confirmPasswordError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 hover:border-gray-400'
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
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                <span>{confirmPasswordError}</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF4F52] text-white py-3 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:bg-gray-400 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <div className="mt-8 flex justify-center">
          <Link to="/login" className="text-sm text-[#FF4F52] hover:text-gray-800 font-medium">
            Back to login
          </Link>
        </div>
      </div>
      <div className="flex-1 bg-[rgba(249,13,17,0.04)] flex items-center justify-center px-12 py-8">
        {illustration ? (
          <img src={illustration} alt="Set new password" className="w-full max-w-md object-contain" />
        ) : null}
      </div>
    </div>
  );
}
