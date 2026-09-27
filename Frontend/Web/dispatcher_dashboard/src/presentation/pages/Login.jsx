import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input } from 'antd';
import { AtSign } from 'lucide-react';
import { alertUser } from '@/presentation/feedback/alertUser';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import illustration from '@/presentation/assets/illustration.svg';
import { DEV_MODE } from '@/core/config/app.config';
import { getDefaultRouteByRole } from '@/core/constants';
import { persistAuthToken, getStoredUser } from '@/core/auth/session';
import { loginDispatcher, verifyDispatcherOtp } from '@/data/api/auth.api';
import { AuthCardLayout } from '@/presentation/components/layout/AuthCardLayout';

function postLoginPath(role) {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return getDefaultRouteByRole(role);
}

export default function Login({ onSuccess, onForgotPasswordClick }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (sessionToken) {
      if (!otp || otp.length !== 6) {
        alertUser({
          icon: 'warning',
          title: 'Invalid code',
          text: 'Please enter the 6-digit code from your email.',
          confirmButtonColor: '#134178',
        });
        return;
      }
      setLoading(true);
      try {
        const data = await verifyDispatcherOtp(sessionToken, otp);
        persistAuthToken(data.token);
        alertUser({
          icon: 'success',
          title: 'Welcome back!',
          text: 'You have successfully logged in.',
          timer: 1500,
          showConfirmButton: false,
          timerProgressBar: true,
        }).then(() => {
          onSuccess(data);
          navigate(postLoginPath(getStoredUser().role));
        });
      } catch (err) {
        alertUser({
          icon: 'error',
          title: 'Verification failed',
          text: err.message || 'Invalid or expired code. Please try again.',
          confirmButtonColor: '#134178',
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      alertUser({
        icon: 'warning',
        title: 'Missing fields',
        text: 'Please enter your email and password.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    setLoading(true);

    try {
      const data = await loginDispatcher(email, password);
      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
        setOtp('');
        alertUser({
          icon: 'info',
          title: 'Check your email',
          text: data.message || 'Enter the 6-digit code sent to your email.',
          confirmButtonColor: '#134178',
        });
      } else {
        persistAuthToken(data.token);
        alertUser({
          icon: 'success',
          title: 'Welcome back!',
          text: 'You have successfully logged in.',
          timer: 1500,
          showConfirmButton: false,
          timerProgressBar: true,
        }).then(() => {
          onSuccess(data);
          navigate(postLoginPath(getStoredUser().role));
        });
      }
    } catch (err) {
      alertUser({
        icon: 'error',
        title: 'Login failed',
        text: err.message || 'Invalid credentials. Please try again.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardLayout illustration={illustration}>
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2 transition-all duration-300">Welcome back!</h2>
        <p className="text-muted">
          Secure Emergency Response Management Platform through{' '}
          <span className="text-primary font-semibold">RescueLink!</span>
        </p>
      </div>

      <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
        {sessionToken ? (
          <>
            <Form.Item>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="text-center tracking-widest text-xl"
              />
              <p className="text-sm text-muted mt-2 mb-0">Check your email for the code.</p>
            </Form.Item>
            <Form.Item>
              <Button type="link" onClick={() => { setSessionToken(null); setOtp(''); }} className="!px-0">
                &larr; Back to login
              </Button>
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                suffix={<AtSign className="w-5 h-5 text-muted" strokeWidth={2} />}
                autoComplete="email"
              />
            </Form.Item>
            <Form.Item label="Password" htmlFor="login-password">
              <Input.Password
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Form.Item>
            <div className="flex justify-end -mt-2 mb-4">
              <Button type="link" onClick={() => navigate('/forgot-password')} className="!px-0">
                Forgot Password?
              </Button>
            </div>
          </>
        )}

        <Form.Item className="mb-0">
          <Button type="primary" htmlType="submit" block loading={loading}>
            {sessionToken ? 'Verify' : 'Login'}
          </Button>
        </Form.Item>
      </Form>

      {DEV_MODE && (
        <div className="mt-8 bg-card/80 border border-border rounded-md p-4">
          <p className="text-sm font-semibold text-amber-500 dark:text-amber-400 mb-3">🚧 Development Mode - Quick Navigation:</p>
          <div className="grid grid-cols-2 gap-2">
            {['/dashboard', '/map', '/departments', '/audit', '/adminactions', '/profile', '/settings', '/forgot-password', '/enter-code', '/create-password'].map((path) => (
              <Button key={path} type="default" onClick={() => navigate(path)} className="text-xs">
                {path.slice(1) || 'Dashboard'}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-card/80 border border-border rounded-md p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <p className="text-sm text-muted">
          <strong className="text-foreground">Security Note:</strong>{' '}
          Role-based access control ensures only authorized personnel can access sensitive citizen incident data.
        </p>
      </div>
    </AuthCardLayout>
  );
}
