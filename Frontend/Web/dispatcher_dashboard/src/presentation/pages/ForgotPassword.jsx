import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { AtSign } from 'lucide-react';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import illustration from '@/presentation/assets/forgot-password-illustration.svg';
import { API_URL } from '@/core/config/app.config';
import { AuthCardLayout } from '@/presentation/components/layout/AuthCardLayout';
import { AuthFloatingInput } from '@/presentation/components/ui/AuthFloatingInput';

export default function ForgotPassword({ onSuccess, onBackToLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email address is required';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) setEmailError(validateEmail(value));
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
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset link');
      }

      Swal.fire({
        icon: 'success',
        title: 'Check your email',
        text: data.message || "If an account exists, you'll receive a link to reset your password.",
        confirmButtonColor: '#134178',
      }).then(() => navigate('/login'));
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthFloatingInput
          label="Email Address"
          type="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={() => setEmailError(validateEmail(email))}
          rightIcon={<AtSign className="w-5 h-5" strokeWidth={2} />}
          error={emailError}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-hover disabled:bg-muted/40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-card focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm text-muted">or back to login</span>
          <div className="flex-1 border-t border-border" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-12 h-12 bg-primary rounded-full flex items-center justify-center hover:bg-primary-hover transition-all duration-300 transform hover:scale-[1.05] active:scale-[0.95] shadow-card text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
    </AuthCardLayout>
  );
}
