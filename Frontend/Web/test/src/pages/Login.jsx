import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg';
import illustration from '../assets/illustration.svg';

const API_URL = 'http://localhost:3000';
const DEV_MODE = true; // Set to false when ready for production

export default function Login({ onSuccess, onForgotPasswordClick }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
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
          <h2 className="text-4xl font-bold text-gray-800 mb-3 transition-all duration-300">Welcome back!</h2>
          <p className="text-lg text-gray-700">
            Secure Emergency Response Management Platform through{' '}
            <span className="text-[#FF4F52] font-semibold">RescueLink!</span>
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email/Username Field */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Email / Username
            </label>
            <input
              type="text"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 hover:border-gray-400 hover:bg-gray-50"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 hover:border-gray-400 hover:bg-gray-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
              className="text-sm font-semibold text-gray-800 hover:text-gray-600"
            >
              Forgot Password?
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 animate-fade-in">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800 flex-1">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF4F52] text-white py-3 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:bg-gray-400 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl hover:shadow-gray-500/30"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Development Mode Quick Navigation */}
        {DEV_MODE && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-900 mb-3">🚧 Development Mode - Quick Navigation:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/map')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Map View
              </button>
              <button
                type="button"
                onClick={() => navigate('/departments')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Departments
              </button>
              <button
                type="button"
                onClick={() => navigate('/taskboard')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Task Board
              </button>
              <button
                type="button"
                onClick={() => navigate('/audit')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Audit Log
              </button>
              <button
                type="button"
                onClick={() => navigate('/adminactions')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Admin Actions
              </button>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Forgot Password
              </button>
              <button
                type="button"
                onClick={() => navigate('/enter-code')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Enter Code
              </button>
              <button
                type="button"
                onClick={() => navigate('/create-password')}
                className="text-xs px-3 py-2 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-100 text-yellow-900 transition-colors"
              >
                Create Password
              </button>
            </div>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm">
            <strong className="text-black">Security Note:</strong>{' '}
            <span className="text-blue-600">Role-based access control ensures only authorized personnel can access sensitive citizen incident data.</span>
          </p>
        </div>
      </div>

      {/* Right Panel - Illustration */}
      <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center px-12 py-8 relative overflow-hidden">
        {/* Decorative rounded corners */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-full opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-tl-full opacity-20"></div>

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
              <p className="text-gray-400 text-sm">Illustration will appear here</p>
            </div>
          )}
        </div>

        {/* Tagline */}
        <div className="absolute bottom-8 left-0 right-0 text-center z-20">
          <p className="text-gray-800 font-medium text-lg">One Tap. One Report. Faster Response.</p>
        </div>
      </div>
    </div>
  );
}
