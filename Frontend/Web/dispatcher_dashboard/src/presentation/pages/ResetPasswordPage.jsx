import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button, Form, Input } from 'antd';
import { alertUser } from '@/presentation/feedback/alertUser';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import illustration from '@/presentation/assets/create-password-illustration.svg';
import { API_URL } from '@/core/config/app.config';
import { AuthCardLayout } from '@/presentation/components/layout/AuthCardLayout';

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

  const handleSubmit = async () => {
    const passwordValidationError = validatePassword(newPassword);
    const confirmValidationError = validateConfirmPassword(confirmPassword, newPassword);
    if (passwordValidationError) setPasswordError(passwordValidationError);
    if (confirmValidationError) setConfirmPasswordError(confirmValidationError);
    if (passwordValidationError || confirmValidationError) {
      alertUser({
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
      alertUser({
        icon: 'success',
        title: 'Password reset!',
        text: 'Your password has been updated. Redirecting to login...',
        confirmButtonColor: '#134178',
      }).then(() => navigate('/login'));
    } catch (err) {
      alertUser({
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
          <Link to="/forgot-password">
            <Button type="primary" block>
              Request new link
            </Button>
          </Link>
          <Link to="/login">
            <Button block>
              Back to login
            </Button>
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

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          label="New Password"
          htmlFor="reset-new-password"
          validateStatus={passwordError ? 'error' : ''}
          help={passwordError || undefined}
        >
          <Input.Password
            id="reset-new-password"
            value={newPassword}
            onChange={handleNewPasswordChange}
            onBlur={() => setPasswordError(validatePassword(newPassword))}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item
          label="Confirm Password"
          htmlFor="reset-confirm-password"
          validateStatus={confirmPasswordError ? 'error' : ''}
          help={confirmPasswordError || undefined}
        >
          <Input.Password
            id="reset-confirm-password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            onBlur={() => setConfirmPasswordError(validateConfirmPassword(confirmPassword, newPassword))}
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item className="mb-0">
          <Button type="primary" htmlType="submit" block loading={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </Form.Item>
      </Form>

      <div className="mt-8 flex justify-center">
        <Link to="/login">
          <Button type="link">Back to login</Button>
        </Link>
      </div>
    </AuthCardLayout>
  );
}
