import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { AtSign, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import illustration from '@/presentation/assets/illustration.svg';
import { DEV_MODE } from '@/core/config/app.config';
import { getDefaultRouteByRole } from '@/core/constants';
import { persistAuthToken, getStoredUser } from '@/core/auth/session';
import { loginDispatcher, verifyDispatcherOtp } from '@/data/api/auth.api';
import { AuthCardLayout } from '@/presentation/components/layout/AuthCardLayout';
import { AuthFloatingInput } from '@/presentation/components/ui/AuthFloatingInput';

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputBase =
    'w-full px-4 py-3 border-2 border-border rounded-xl bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition-all duration-300 hover:border-primary/50';

  const handleLogin = async (e) => {
    e.preventDefault();
    if (sessionToken) {
      if (!otp || otp.length !== 6) {
        Swal.fire({
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
        Swal.fire({
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
        Swal.fire({
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
      Swal.fire({
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
        Swal.fire({
          icon: 'info',
          title: 'Check your email',
          text: data.message || 'Enter the 6-digit code sent to your email.',
          confirmButtonColor: '#134178',
        });
      } else {
        persistAuthToken(data.token);
        Swal.fire({
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
      Swal.fire({
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

      <form onSubmit={handleLogin} className="space-y-6">
        {sessionToken ? (
          <>
            <div>
              <div className="relative flex items-center rounded-xl border-2 border-border bg-card transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2 focus-within:ring-offset-background">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className={`${inputBase} text-center tracking-widest text-xl`}
                />
              </div>
              <p className="text-sm text-muted mt-2">Check your email for the code.</p>
            </div>
            <button
              type="button"
              onClick={() => { setSessionToken(null); setOtp(''); }}
              className="text-sm font-semibold text-foreground hover:text-muted transition-colors"
            >
              &larr; Back to login
            </button>
          </>
        ) : (
          <>
            <AuthFloatingInput
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              rightIcon={<AtSign className="w-5 h-5" strokeWidth={2} />}
            />
            <AuthFloatingInput
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              rightAction={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
                </button>
              }
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm font-semibold text-foreground hover:text-muted transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-hover disabled:bg-muted/40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-card hover:shadow-primary/20 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          {loading ? (sessionToken ? 'Verifying...' : 'Logging in...') : (sessionToken ? 'Verify' : 'Login')}
        </button>
      </form>

      {DEV_MODE && (
        <div className="mt-8 bg-card/80 border border-border rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-500 dark:text-amber-400 mb-3">🚧 Development Mode - Quick Navigation:</p>
          <div className="grid grid-cols-2 gap-2">
            {['/dashboard', '/map', '/departments', '/audit', '/adminactions', '/profile', '/settings', '/forgot-password', '/enter-code', '/create-password'].map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className="text-xs px-3 py-2 bg-background/80 border border-border rounded-lg hover:bg-primary/10 text-foreground transition-colors"
              >
                {path.slice(1) || 'Dashboard'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-card/80 border border-border rounded-xl p-4 flex items-start gap-3">
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
