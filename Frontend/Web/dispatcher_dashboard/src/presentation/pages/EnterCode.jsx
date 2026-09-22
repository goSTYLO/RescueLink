import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input } from 'antd';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { alertUser } from '@/presentation/feedback/alertUser';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
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
      inputRefs.current[focusIndex]?.focus();
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

  const handleSubmit = async () => {
    const validationError = validateCode();
    if (validationError) {
      alertUser({
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

      alertUser({
        icon: 'success',
        title: 'Code verified!',
        text: 'Proceeding to create your new password.',
        confirmButtonColor: '#134178',
      }).then(() => navigate('/create-password'));
    } catch (err) {
      alertUser({
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

  return (
    <AuthCardLayout
      illustration={illustration}
      tagline="For security reasons, verification codes expire after a limited time."
    >
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2 transition-all duration-300">Enter Code</h2>
        <p className="text-muted">
          We've sent a verification code to your email. Please enter it below.
        </p>
      </div>

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          validateStatus={codeError ? 'error' : ''}
          help={codeError || undefined}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-primary" strokeWidth={2} />
            <span className="text-sm font-medium text-foreground">Verification Code</span>
          </div>
          <div className="flex justify-center gap-3">
            {code.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="!w-14 !h-14 text-center text-2xl font-bold"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>
        </Form.Item>

        <Form.Item className="mb-0">
          <Button type="primary" htmlType="submit" block loading={loading}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </Form.Item>
      </Form>

      <div className="mt-4 text-center">
        <Button
          type="link"
          onClick={() => {
            alertUser({
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
        </Button>
      </div>

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
