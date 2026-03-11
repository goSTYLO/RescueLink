import { TextDecoder, TextEncoder } from 'util';
import { render, screen, waitFor } from '@testing-library/react';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
  MAPBOX_ACCESS_TOKEN: '',
}));

jest.mock('@/infrastructure/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, callback) => {
    callback(null);
    return () => {};
  },
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/presentation/pages/Login', () => () => <div>Login page</div>);
jest.mock('@/presentation/pages/Dashboard', () => () => <div>Legacy Dashboard</div>);
jest.mock('@/presentation/pages/DashboardPage', () => ({ DashboardPage: () => <div>Dashboard page</div> }));
jest.mock('@/presentation/pages/IncidentDetailsPage', () => ({ IncidentDetailsPage: () => <div>Incident details</div> }));
jest.mock('@/presentation/pages/MapViewPage', () => ({ MapViewPage: () => <div>Map page</div> }));
jest.mock('@/presentation/pages/DepartmentsPage', () => ({ DepartmentsPage: () => <div>Departments page</div> }));
jest.mock('@/presentation/pages/DepartmentDetailsPage', () => ({ DepartmentDetailsPage: () => <div>Department details page</div> }));
jest.mock('@/presentation/pages/AuditLogPage', () => ({ AuditLogPage: () => <div>Audit page</div> }));
jest.mock('@/presentation/pages/AdminActionsPage', () => ({ AdminActionsPage: () => <div>Admin actions page</div> }));
jest.mock('@/presentation/pages/ProfilePage', () => ({ ProfilePage: () => <div>Profile page</div> }));
jest.mock('@/presentation/pages/SettingsPage', () => ({ SettingsPage: () => <div>Settings page</div> }));
jest.mock('@/presentation/pages/HelpSupportPage', () => ({ HelpSupportPage: () => <div>Help page</div> }));
jest.mock('@/presentation/pages/TeamPage', () => ({ TeamPage: () => <div>Team page</div> }));
jest.mock('@/presentation/pages/DepartmentDashboardPage', () => ({ DepartmentDashboardPage: () => <div>Department dashboard page</div> }));
jest.mock('@/presentation/pages/DepartmentTasksPage', () => ({ DepartmentTasksPage: () => <div>Department tasks page</div> }));
jest.mock('@/presentation/pages/DepartmentPersonnelPage', () => ({ DepartmentPersonnelPage: () => <div>Department personnel page</div> }));
jest.mock('@/presentation/pages/DepartmentVehiclesPage', () => ({ DepartmentVehiclesPage: () => <div>Department vehicles page</div> }));
jest.mock('@/presentation/pages/ForgotPassword', () => () => <div>Forgot password page</div>);
jest.mock('@/presentation/pages/EnterCode', () => () => <div>Enter code page</div>);
jest.mock('@/presentation/pages/CreateNewPassword', () => () => <div>Create password page</div>);
jest.mock('@/presentation/pages/ResetPasswordPage', () => () => <div>Reset password page</div>);
jest.mock('@/presentation/components/common/AccessDeniedNotice', () => ({
  AccessDeniedNotice: ({ message }) => <div>{message}</div>,
}));

const App = require('@/App').default;

describe('App route guards', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('redirects unauthenticated root route to login', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument());
  });

  test('department admin lands on department dashboard path from root', async () => {
    sessionStorage.setItem('token', 'jwt');
    sessionStorage.setItem('user', JSON.stringify({ role: 'department-admin' }));
    window.history.pushState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByText('Department dashboard page')).toBeInTheDocument());
  });

  test('dispatcher lands on dashboard path from root', async () => {
    sessionStorage.setItem('token', 'jwt');
    sessionStorage.setItem('user', JSON.stringify({ role: 'dispatcher' }));
    window.history.pushState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument());
  });

  test('dispatcher is denied from admin-only departments route', async () => {
    sessionStorage.setItem('token', 'jwt');
    sessionStorage.setItem('user', JSON.stringify({ role: 'dispatcher' }));
    window.history.pushState({}, '', '/departments');
    render(<App />);
    await waitFor(() => expect(screen.getByText('Your role does not allow access to this route.')).toBeInTheDocument());
  });
});
