import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import SignUp from './pages/SignUp';
import PhoneVerification from './pages/PhoneVerification';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

const API_URL = 'http://localhost:3000';

export default function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignUpSuccess = () => {
    setPage('verify');
  };

  const handleVerificationSuccess = () => {
    setPage('login');
  };

  const handleLoginSuccess = (data) => {
    setUserData(data.user);
    setPage('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      setPage('login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {page === 'login' && (
        <Login onSuccess={handleLoginSuccess} onSignUpClick={() => setPage('signup')} />
      )}
      {page === 'signup' && (
        <SignUp onSuccess={handleSignUpSuccess} onLoginClick={() => setPage('login')} />
      )}
      {page === 'verify' && (
        <PhoneVerification onSuccess={handleVerificationSuccess} />
      )}
      {page === 'dashboard' && (
        <Dashboard user={userData || user} onLogout={handleLogout} />
      )}
    </div>
  );
}
