import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { KeyRound } from 'lucide-react';
import logo from '@/presentation/assets/logo.svg';
import illustration from '@/presentation/assets/enter-code-illustration.svg';
import { API_URL } from '@/core/config/app.config';
import { AuthCardLayout } from '@/presentation/components/layout/AuthCardLayout';

export default function EnterCode({ onSuccess, onBackToLogin }) {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  const handleCodeChange = (index, value) => {
    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      const nextEmptyIndex = newCode.findIndex((val, i) => i >= index && val === '');
      const focusIndex = nextEmptyIndex === -1 ? 5 : Math.min(nextEmptyIndex, 5);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex].focus();
      }
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setCodeError('');

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
    if (codeString.length !== 6) return 'Please enter the complete 6-digit code';
    if (!/^\d{6}$/.test(codeString)) return 'Code must contain only numbers';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateCode();
    if (validationError) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid code',
        text: validationError,
        confirmButtonColor: '#134178',
      });
      setCodeError(validationError);
      return;
    }

    setLoading(true);
    setCodeError('');

    try {
      const email = sessionStorage.getItem('resetEmail');
      const codeString = code.join('');

      const response = await fetch(`${API_URL}/api/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeString }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code');
      }

      Swal.fire({
        icon: 'success',
        title: 'Code verified!',
        text: 'Proceeding to create your new password.',
        confirmButtonColor: '#134178',
      }).then(() => navigate('/create-password'));
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Verification failed',
        text: err.message || 'Invalid code. Please try again.',
        confirmButtonColor: '#134178',
      });
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition-all duration-300 bg-card text-foreground border-border hover:border-primary/50';

  return (
    <AuthCardLayout
      illustration={illustration}
      tagline="For security reasons, verification codes expire after a limited time."
    >
      <div className="mb-8">
        <img src={logo} alt="RescueLink Logo" className="h-12 w-auto" />
      </div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2 transition-all duration-300">Enter Code</h2>
        <p className="text-muted">
          We've sent a verification code to your email. Please enter it below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-primary" strokeWidth={2} />
            <label className="text-sm font-medium text-foreground">Verification Code</label>
          </div>
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
                className={inputBase}
              />
            ))}
          </div>
          {codeError && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-destructive">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{codeError}</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-hover disabled:bg-muted/40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-card focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          className="text-sm text-primary hover:text-primary-hover font-medium transition-colors underline underline-offset-2"
          onClick={() => {
            Swal.fire({
              icon: 'success',
              title: 'Code resent',
              text: 'A new verification code has been sent to your email.',
              timer: 2000,
              showConfirmButton: false,
              timerProgressBar: true,
            });
          }}
        >
          Didn't receive the code? Resend
        </button>
      </div>

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
