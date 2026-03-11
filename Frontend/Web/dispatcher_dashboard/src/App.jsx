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
import { AssignedIncidentsPage } from '@/presentation/pages/AssignedIncidentsPage';
import { DepartmentTasksPage } from '@/presentation/pages/DepartmentTasksPage';
import { DepartmentPersonnelPage } from '@/presentation/pages/DepartmentPersonnelPage';
import { DepartmentVehiclesPage } from '@/presentation/pages/DepartmentVehiclesPage';
import ForgotPassword from '@/presentation/pages/ForgotPassword';
import EnterCode from '@/presentation/pages/EnterCode';
import CreateNewPassword from '@/presentation/pages/CreateNewPassword';
import ResetPasswordPage from '@/presentation/pages/ResetPasswordPage';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';
import { clearAuthSession, hasRoleAccess } from '@/core/auth/session';
import { logout as logoutDispatcher } from '@/data/api/auth.api';

const SUPER_ADMIN_ONLY = [ROLES.SUPER_ADMIN];
const DASHBOARD_OPERATIONS_ROLES = [ROLES.SUPER_ADMIN, ROLES.DISPATCHER];
const DEPARTMENT_AND_UP = [ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_ADMIN];
const ANY_AUTH_ROLE = [ROLES.SUPER_ADMIN, ROLES.DISPATCHER, ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PERSONNEL];

// Protected Route Component
function ProtectedRoute({ children, allowedRoles = [] }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(ROLES.PERSONNEL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In dev mode, set a mock user and skip auth
    if (DEV_MODE) {
      // Set mock user in sessionStorage for Layout component (Super Admin by default)
      if (!sessionStorage.getItem('user')) {
        sessionStorage.setItem('user', JSON.stringify({
          username: 'Super Admin',
          name: 'Super Admin',
          email: 'admin@rescuelink.dagupan.gov.ph',
          role: 'super-admin',
          department: 'All',
          departmentId: null
        }));
      }
      setUser({ uid: 'dev-user' });
      setUserRole(ROLES.SUPER_ADMIN);
      setLoading(false);
      return;
    }

    // Production mode - check JWT token in sessionStorage
    const token = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUserRole(normalizeRole(parsedUser?.role));
      } catch (_) {
        setUserRole(ROLES.PERSONNEL);
      }
      setUser({ authenticated: true });
    } else {
      setUser(null);
      setUserRole(ROLES.PERSONNEL);
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

  if (!hasRoleAccess(userRole, allowedRoles)) {
    const redirectPath = userRole === ROLES.DEPARTMENT_ADMIN
      ? '/department/dashboard'
      : userRole === ROLES.DEPARTMENT_HEAD
        ? '/department/assigned-incidents'
        : userRole === ROLES.PERSONNEL
          ? '/department/tasks'
          : '/dashboard';
    return (
      <AccessDeniedNotice
        message="Your role does not allow access to this route."
        redirectPath={redirectPath}
        redirectLabel="Go to Allowed Page"
      />
    );
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
    const department = data.user?.department ?? (role === ROLES.SUPER_ADMIN ? 'All' : '');
    const departmentId = data.user?.departmentId ?? data.user?.department_id ?? null;
    sessionStorage.setItem('user', JSON.stringify({
      username: displayName,
      name: displayName,
      email: data.user?.email || '',
      firstName: data.user?.firstName,
      lastName: data.user?.lastName,
      role,
      department,
      departmentId,
    }));
    setPage('dashboard');
  };

  const handleLogout = async () => {
    try {
      await logoutDispatcher();
      await signOut(auth);
      setUserData(null);
      clearAuthSession();
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
            <ProtectedRoute allowedRoles={DASHBOARD_OPERATIONS_ROLES}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute allowedRoles={ANY_AUTH_ROLE}>
              <MapViewPage />
            </ProtectedRoute>
          } />
          <Route path="/departments" element={
            <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
              <DepartmentsPage />
            </ProtectedRoute>
          } />
          <Route path="/departments/:id" element={
            <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
              <DepartmentDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/audit" element={
            <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
              <AuditLogPage />
            </ProtectedRoute>
          } />
          <Route path="/adminactions" element={
            <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
              <AdminActionsPage />
            </ProtectedRoute>
          } />
          <Route path="/team" element={
            <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
              <TeamPage />
            </ProtectedRoute>
          } />
          <Route path="/department/dashboard" element={
            <ProtectedRoute allowedRoles={DEPARTMENT_AND_UP}>
              <DepartmentDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/department/assigned-incidents" element={
            <ProtectedRoute allowedRoles={[ROLES.DEPARTMENT_HEAD]}>
              <AssignedIncidentsPage />
            </ProtectedRoute>
          } />
          <Route path="/department/tasks" element={
            <ProtectedRoute allowedRoles={ANY_AUTH_ROLE}>
              <DepartmentTasksPage />
            </ProtectedRoute>
          } />
          <Route path="/department/personnel" element={
            <ProtectedRoute allowedRoles={DEPARTMENT_AND_UP}>
              <DepartmentPersonnelPage />
            </ProtectedRoute>
          } />
          <Route path="/department/vehicles" element={
            <ProtectedRoute allowedRoles={DEPARTMENT_AND_UP}>
              <DepartmentVehiclesPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={ANY_AUTH_ROLE}>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={SUPER_ADMIN_ONLY}>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/help" element={
            <ProtectedRoute allowedRoles={ANY_AUTH_ROLE}>
              <HelpSupportPage />
            </ProtectedRoute>
          } />
          <Route path="/incidents/:id" element={
            <ProtectedRoute allowedRoles={ANY_AUTH_ROLE}>
              <IncidentDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            (() => {
              if (!DEV_MODE && !sessionStorage.getItem('token')) return <Navigate to="/login" replace />;
              try {
                const u = JSON.parse(sessionStorage.getItem('user') || '{}');
                const r = normalizeRole(u.role);
                if (r === ROLES.DEPARTMENT_HEAD) return <Navigate to="/department/assigned-incidents" replace />;
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
