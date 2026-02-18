import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import logo from '@/presentation/assets/logo.svg';
import illustration from '@/presentation/assets/illustration.svg';
import { DEV_MODE } from '@/core/config/app.config';
import { loginDispatcher, verifyDispatcherOtp } from '@/data/api/auth.api';

export default function Login({ onSuccess, onForgotPasswordClick }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionToken, setSessionToken] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
        localStorage.setItem('token', data.token);
        Swal.fire({
          icon: 'success',
          title: 'Welcome back!',
          text: 'You have successfully logged in.',
          timer: 1500,
          showConfirmButton: false,
          timerProgressBar: true,
        }).then(() => {
          onSuccess(data);
          navigate('/dashboard');
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
        localStorage.setItem('token', data.token);
        Swal.fire({
          icon: 'success',
          title: 'Welcome back!',
          text: 'You have successfully logged in.',
          timer: 1500,
          showConfirmButton: false,
          timerProgressBar: true,
        }).then(() => {
          onSuccess(data);
          navigate('/dashboard');
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
    <div className="flex min-h-screen bg-background">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-12 py-8 max-w-2xl">
        {/* Logo */}
        <div className="mb-12">
          <img 
            src={logo} 
            alt="RescueLink Logo" 
            className="h-20 w-auto"
          />
        </div>

        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-foreground mb-3 transition-all duration-300">Welcome back!</h2>
          <p className="text-lg text-muted">
            Secure Emergency Response Management Platform through{' '}
            <span className="text-primary font-semibold">RescueLink!</span>
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {sessionToken ? (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-[rgba(19,65,120,0.35)] rounded-xl bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background focus:border-secondary transition-all duration-300 hover:border-secondary/50 text-center tracking-widest text-xl"
                />
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
          {/* Email/Username Field */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email / Username
            </label>
            <input
              type="text"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-[rgba(19,65,120,0.35)] rounded-xl bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background focus:border-secondary transition-all duration-300 hover:border-secondary/50"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border-2 border-[rgba(19,65,120,0.35)] rounded-xl bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background focus:border-secondary transition-all duration-300 hover:border-secondary/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? (
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
          </div>

          {/* Forgot Password Link */}
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

          {/* Login / Verify Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg hover:bg-primary-hover disabled:bg-muted/40 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-card hover:shadow-card-hover hover:shadow-primary/20 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            {loading ? (sessionToken ? 'Verifying...' : 'Logging in...') : (sessionToken ? 'Verify' : 'Login')}
          </button>
        </form>

        {/* Development Mode Quick Navigation */}
        {DEV_MODE && (
          <div className="mt-8 bg-card border border-[rgba(19,65,120,0.35)] rounded-lg p-4">
            <p className="text-sm font-semibold text-amber-400 mb-3">🚧 Development Mode - Quick Navigation:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/map')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Map View
              </button>
              <button
                type="button"
                onClick={() => navigate('/departments')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Departments
              </button>
              <button
                type="button"
                onClick={() => navigate('/taskboard')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Task Board
              </button>
              <button
                type="button"
                onClick={() => navigate('/audit')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Audit Log
              </button>
              <button
                type="button"
                onClick={() => navigate('/adminactions')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Admin Actions
              </button>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Forgot Password
              </button>
              <button
                type="button"
                onClick={() => navigate('/enter-code')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Enter Code
              </button>
              <button
                type="button"
                onClick={() => navigate('/create-password')}
                className="text-xs px-3 py-2 bg-background border border-[rgba(19,65,120,0.35)] rounded-lg hover:bg-secondary/30 text-foreground transition-colors"
              >
                Create Password
              </button>
            </div>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-8 bg-card border border-[rgba(19,65,120,0.35)] rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-secondary-light flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm text-muted">
            <strong className="text-foreground">Security Note:</strong>{' '}
            Role-based access control ensures only authorized personnel can access sensitive citizen incident data.
          </p>
        </div>
      </div>

      {/* Right Panel - Illustration */}
      <div className="flex-1 bg-card flex flex-col items-center justify-center px-12 py-8 relative overflow-hidden border-l border-[rgba(19,65,120,0.35)]">
        {/* Decorative rounded corners */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/20 rounded-bl-full opacity-40"></div>
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-secondary/20 rounded-tl-full opacity-40"></div>

        {/* Illustration Image */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          {illustration ? (
            <img 
              src={illustration} 
              alt="RescueLink Illustration" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">Illustration will appear here</p>
            </div>
          )}
        </div>

        {/* Tagline */}
        <div className="absolute bottom-8 left-0 right-0 text-center z-20">
          <p className="text-foreground font-medium text-lg">One Tap. One Report. Faster Response.</p>
        </div>
      </div>
    </div>
  );
}
