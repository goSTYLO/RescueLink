import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import illustration from '@/presentation/assets/create-password-illustration.svg';
import { API_URL } from '@/core/config/app.config';
import { AuthCardLayout } from '@/presentation/components/layout/AuthCardLayout';
import { AuthFloatingInput } from '@/presentation/components/ui/AuthFloatingInput';

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
      <AuthCardLayout illustration={illustration} tagline="Request a new link from the forgot password page.">
        <div className="mb-6">
          <BrandLogo size="lg" />
        </div>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Invalid or expired link</h2>
          <p className="text-muted">
            This password reset link is missing or has expired. Please request a new one.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/forgot-password"
            className="inline-flex justify-center px-6 py-3 rounded-xl font-semibold bg-primary text-white hover:bg-primary-hover transition-all"
          >
            Request new link
          </Link>
          <Link
            to="/login"
            className="inline-flex justify-center px-6 py-3 rounded-xl font-semibold border-2 border-border text-foreground hover:bg-muted/50 transition-all"
          >
            Back to login
          </Link>
        </div>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout illustration={illustration} tagline="Create a strong password to secure your account.">
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2 transition-all duration-300">Set new password</h2>
        <p className="text-muted">Create a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthFloatingInput
          label="New Password"
          type={showNewPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={handleNewPasswordChange}
          onBlur={() => setPasswordError(validatePassword(newPassword))}
          rightAction={
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="p-1.5 rounded-lg text-muted hover:text-foreground transition-colors"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
            >
              {showNewPassword ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
            </button>
          }
          error={passwordError}
        />
        <AuthFloatingInput
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          onBlur={() => setConfirmPasswordError(validateConfirmPassword(confirmPassword, newPassword))}
          rightAction={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="p-1.5 rounded-lg text-muted hover:text-foreground transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
            </button>
          }
          error={confirmPasswordError}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-hover disabled:bg-muted/40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-card focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <div className="mt-8 flex justify-center">
        <Link to="/login" className="text-sm text-primary hover:text-primary-hover font-medium">
          Back to login
        </Link>
      </div>
    </AuthCardLayout>
  );
}
