import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input } from 'antd';
import { AtSign, ArrowLeft } from 'lucide-react';
import { alertUser } from '@/presentation/feedback/alertUser';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import illustration from '@/presentation/assets/forgot-password-illustration.svg';
import { API_URL } from '@/core/config/app.config';
import { AuthCardLayout } from '@/presentation/components/layout/AuthCardLayout';

export default function ForgotPassword({ onSuccess, onBackToLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return 'Email address is required';
    if (!emailRegex.test(value)) return 'Please enter a valid email address';
    return '';
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) setEmailError(validateEmail(value));
  };

  const handleSubmit = async () => {
    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      alertUser({
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
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset link');
      }

      alertUser({
        icon: 'success',
        title: 'Check your email',
        text: data.message || "If an account exists, you'll receive a link to reset your password.",
        confirmButtonColor: '#134178',
      }).then(() => navigate('/login'));
    } catch (err) {
      alertUser({
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
    <AuthCardLayout
      illustration={illustration}
      tagline="For security reasons, password reset links expire after a limited time."
    >
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2 transition-all duration-300">Forgot Your Password?</h2>
        <p className="text-muted">
          Enter your registered email and we'll send you instructions to reset your password.
        </p>
      </div>

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          label="Email Address"
          htmlFor="forgot-email"
          validateStatus={emailError ? 'error' : ''}
          help={emailError || undefined}
        >
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => setEmailError(validateEmail(email))}
            suffix={<AtSign className="w-5 h-5 text-muted" strokeWidth={2} />}
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item className="mb-0">
          <Button type="primary" htmlType="submit" block loading={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </Form.Item>
      </Form>

      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm text-muted">or back to login</span>
          <div className="flex-1 border-t border-border" />
        </div>
        <Button
          type="primary"
          shape="circle"
          icon={<ArrowLeft className="w-5 h-5" strokeWidth={2} />}
          onClick={() => navigate('/login')}
          aria-label="Back to login"
        />
      </div>
    </AuthCardLayout>
  );
}
