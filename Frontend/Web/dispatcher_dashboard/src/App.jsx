import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/infrastructure/firebase';
import { DEV_MODE } from '@/core/config/app.config';
import Login from '@/presentation/pages/Login';
import Dashboard from '@/presentation/pages/Dashboard';
import { DashboardPage } from '@/presentation/pages/DashboardPage';
import { IncidentDetailsPage } from '@/presentation/pages/IncidentDetailsPage';
import { MapViewPage } from '@/presentation/pages/MapViewPage';
import { DepartmentsPage } from '@/presentation/pages/DepartmentsPage';
import { DepartmentDetailsPage } from '@/presentation/pages/DepartmentDetailsPage';
import { TaskBoardPage } from '@/presentation/pages/TaskBoardPage';
import { AuditLogPage } from '@/presentation/pages/AuditLogPage';
import { AdminActionsPage } from '@/presentation/pages/AdminActionsPage';
import { ProfilePage } from '@/presentation/pages/ProfilePage';
import { SettingsPage } from '@/presentation/pages/SettingsPage';
import ForgotPassword from '@/presentation/pages/ForgotPassword';
import EnterCode from '@/presentation/pages/EnterCode';
import CreateNewPassword from '@/presentation/pages/CreateNewPassword';
import ResetPasswordPage from '@/presentation/pages/ResetPasswordPage';

// Protected Route Component
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In dev mode, set a mock user and skip auth
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

    // Production mode - check JWT token in localStorage
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser({ authenticated: true });
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Loading...</div>;
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
    const displayName = [data.user?.firstName, data.user?.lastName].filter(Boolean).join(' ') ||
      data.user?.phone_number || data.user?.phoneNumber || data.user?.phone || data.user?.email || 'user';
    localStorage.setItem('user', JSON.stringify({
      username: displayName,
      name: displayName,
      email: data.user?.email || '',
      firstName: data.user?.firstName,
      lastName: data.user?.lastName,
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
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        {/* Dev Mode Banner */}
        {DEV_MODE && (
          <div className="bg-amber-500/20 text-amber-400 border-b border-amber-500/40 text-center py-2 text-sm font-semibold">
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
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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
              localStorage.getItem('token') ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
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
