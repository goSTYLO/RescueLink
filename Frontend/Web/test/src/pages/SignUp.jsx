import { useState } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const API_URL = 'http://localhost:3000';

export default function SignUp({ onSuccess, onLoginClick }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!phone || !password || !firstName || !lastName) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: '+' + phone, 
          password, 
          firstName, 
          lastName 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store user data for the verification step
      sessionStorage.setItem('pendingUser', JSON.stringify({
        phone: '+' + phone,
        password,
        firstName,
        lastName
      }));

      // Proceed to phone verification
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">RescueLink</h1>
        <p className="text-gray-600 mb-8">Create Your Account</p>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
          <div>
            <label className="text-sm text-gray-700">Phone Number</label>
            <PhoneInput
              country={'ph'}
              value={phone}
              onChange={setPhone}
              inputProps={{
                className: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500',
              }}
            />
          </div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
          <p className="text-center text-gray-600 text-sm">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onLoginClick}
              className="text-indigo-600 hover:underline"
            >
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
