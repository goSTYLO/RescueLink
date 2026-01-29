import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailsPage } from './pages/IncidentDetailsPage';
import { MapViewPage } from './pages/MapViewPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { DepartmentDetailsPage } from './pages/DepartmentDetailsPage';
import { TaskBoardPage } from './pages/TaskBoardPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AdminActionsPage } from './pages/AdminActionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import ForgotPassword from './pages/ForgotPassword';
import EnterCode from './pages/EnterCode';
import CreateNewPassword from './pages/CreateNewPassword';

const API_URL = 'http://localhost:3000';

// Development mode - set to true to bypass authentication for design/testing
const DEV_MODE = true; // Set to false when ready for production

// Protected Route Component
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In dev mode, set a mock user and skip Firebase auth
    if (DEV_MODE) {
      // Set mock user in localStorage for Layout component
      if (!localStorage.getItem('user')) {
        localStorage.setItem('user', JSON.stringify({
          username: 'designer',
          email: 'designer@rescuelink.com',
          role: 'Admin', // Set to Admin to see all menu items
          department: 'All'
        }));
      }
      setUser({ uid: 'dev-user' }); // Mock user object
      setLoading(false);
      return;
    }

    // Production mode - use Firebase auth
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // In dev mode, allow access without authentication
  if (DEV_MODE) {
    return children;
  }

  // Production mode - require authentication
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

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

  const handleLoginSuccess = (data) => {
    setUserData(data.user);
    // Store user in localStorage for Layout component
    localStorage.setItem('user', JSON.stringify({
      username: data.user?.phone_number || data.user?.phoneNumber || data.user?.phone || 'user',
      email: data.user?.email || '',
      role: data.user?.role || 'Operator',
      department: data.user?.department || 'All'
    }));
    setPage('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      localStorage.removeItem('user');
      setPage('login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Dev Mode Banner */}
        {DEV_MODE && (
          <div className="bg-yellow-500 text-black text-center py-2 text-sm font-semibold">
            🚧 DEVELOPMENT MODE - Authentication Bypassed
          </div>
        )}
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={
            <Login onSuccess={handleLoginSuccess} onForgotPasswordClick={() => setPage('forgot-password')} />
          } />
          <Route path="/forgot-password" element={
            <ForgotPassword onSuccess={() => setPage('enter-code')} onBackToLogin={() => setPage('login')} />
          } />
          <Route path="/enter-code" element={
            <EnterCode onSuccess={() => setPage('create-password')} onBackToLogin={() => setPage('login')} />
          } />
          <Route path="/create-password" element={
            <CreateNewPassword onSuccess={() => setPage('login')} onBackToLogin={() => setPage('login')} />
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute>
              <MapViewPage />
            </ProtectedRoute>
          } />
          <Route path="/departments" element={
            <ProtectedRoute>
              <DepartmentsPage />
            </ProtectedRoute>
          } />
          <Route path="/departments/:id" element={
            <ProtectedRoute>
              <DepartmentDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/taskboard" element={
            <ProtectedRoute>
              <TaskBoardPage />
            </ProtectedRoute>
          } />
          <Route path="/audit" element={
            <ProtectedRoute>
              <AuditLogPage />
            </ProtectedRoute>
          } />
          <Route path="/adminactions" element={
            <ProtectedRoute>
              <AdminActionsPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/incidents/:id" element={
            <ProtectedRoute>
              <IncidentDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            DEV_MODE ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } />

          {/* Legacy Dashboard Route (for backward compatibility) */}
          {page === 'dashboard' && (
            <Route path="/legacy-dashboard" element={
              <Dashboard user={userData || user} onLogout={handleLogout} />
            } />
          )}
        </Routes>
      </div>
    </BrowserRouter>
  );
}
