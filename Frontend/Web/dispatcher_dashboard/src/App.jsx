import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/infrastructure/firebase';
import { DEV_MODE } from '@/core/config/app.config';
import { normalizeRole, ROLES } from '@/core/constants';
import Login from '@/presentation/pages/Login';
import Dashboard from '@/presentation/pages/Dashboard';
import { DashboardPage } from '@/presentation/pages/DashboardPage';
import { IncidentDetailsPage } from '@/presentation/pages/IncidentDetailsPage';
import { MapViewPage } from '@/presentation/pages/MapViewPage';
import { DepartmentsPage } from '@/presentation/pages/DepartmentsPage';
import { DepartmentDetailsPage } from '@/presentation/pages/DepartmentDetailsPage';
import { AuditLogPage } from '@/presentation/pages/AuditLogPage';
import { AdminActionsPage } from '@/presentation/pages/AdminActionsPage';
import { ProfilePage } from '@/presentation/pages/ProfilePage';
import { SettingsPage } from '@/presentation/pages/SettingsPage';
import { HelpSupportPage } from '@/presentation/pages/HelpSupportPage';
import { TeamPage } from '@/presentation/pages/TeamPage';
import { DepartmentDashboardPage } from '@/presentation/pages/DepartmentDashboardPage';
import { DepartmentTasksPage } from '@/presentation/pages/DepartmentTasksPage';
import { DepartmentPersonnelPage } from '@/presentation/pages/DepartmentPersonnelPage';
import { DepartmentVehiclesPage } from '@/presentation/pages/DepartmentVehiclesPage';
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
      // Set mock user in localStorage for Layout component (Super Admin by default)
      if (!localStorage.getItem('user')) {
        localStorage.setItem('user', JSON.stringify({
          username: 'Super Admin',
          name: 'Super Admin',
          email: 'admin@rescuelink.dagupan.gov.ph',
          role: 'super-admin',
          department: 'All',
          departmentId: null
        }));
      }
      setUser({ uid: 'dev-user' });
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
    const displayName = [data.user?.firstName, data.user?.lastName].filter(Boolean).join(' ') ||
      data.user?.phone_number || data.user?.phoneNumber || data.user?.phone || data.user?.email || 'user';
    const apiRole = data.user?.role || 'Operator';
    const role = normalizeRole(apiRole);
    const department = data.user?.department || (role === ROLES.SUPER_ADMIN ? 'All' : '');
    const departmentId = data.user?.departmentId ?? data.user?.department_id ?? null;
    localStorage.setItem('user', JSON.stringify({
      username: displayName,
      name: displayName,
      email: data.user?.email || '',
      firstName: data.user?.firstName,
      lastName: data.user?.lastName,
      role,
      department,
      departmentId
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
          <Route path="/team" element={
            <ProtectedRoute>
              <TeamPage />
            </ProtectedRoute>
          } />
          <Route path="/department/dashboard" element={
            <ProtectedRoute>
              <DepartmentDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/department/tasks" element={
            <ProtectedRoute>
              <DepartmentTasksPage />
            </ProtectedRoute>
          } />
          <Route path="/department/personnel" element={
            <ProtectedRoute>
              <DepartmentPersonnelPage />
            </ProtectedRoute>
          } />
          <Route path="/department/vehicles" element={
            <ProtectedRoute>
              <DepartmentVehiclesPage />
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
          <Route path="/help" element={
            <ProtectedRoute>
              <HelpSupportPage />
            </ProtectedRoute>
          } />
          <Route path="/incidents/:id" element={
            <ProtectedRoute>
              <IncidentDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            (() => {
              if (!DEV_MODE && !localStorage.getItem('token')) return <Navigate to="/login" replace />;
              try {
                const u = JSON.parse(localStorage.getItem('user') || '{}');
                const r = normalizeRole(u.role);
                if (r === ROLES.DEPARTMENT_ADMIN) return <Navigate to="/department/dashboard" replace />;
                if (r === ROLES.PERSONNEL) return <Navigate to="/department/tasks" replace />;
              } catch (_) {}
              return <Navigate to="/dashboard" replace />;
            })()
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
