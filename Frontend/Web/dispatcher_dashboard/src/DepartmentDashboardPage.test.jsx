const { TextDecoder, TextEncoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { render, screen, waitFor } = require('@testing-library/react');
const { BrowserRouter } = require('react-router-dom');
const React = require('react');

jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
  ONESIGNAL_APP_ID: '',
}));

jest.mock('@/infrastructure/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, callback) => {
    callback(null);
    return () => {};
  },
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/data/api/incidents.api', () => ({
  getIncidents: jest.fn(() => Promise.resolve([])),
  archiveIncident: jest.fn(() => Promise.resolve({})),
  unarchiveIncident: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/data/api/departments.api', () => ({
  getDepartments: jest.fn(() => Promise.resolve([])),
  getDepartmentById: jest.fn(() => Promise.resolve({ id: 1, name: 'BFP', code: 'BFP' })),
  getResponderTeams: jest.fn(() => Promise.resolve([])),
  getDepartmentUnits: jest.fn(() => Promise.resolve([])),
}));

const { DepartmentDashboardPage } = require('@/presentation/pages/DepartmentDashboardPage');
const { ThemeProvider } = require('@/presentation/context/ThemeContext');

describe('Real DepartmentDashboardPage mount', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('token', 'jwt-test');
    sessionStorage.setItem('user', JSON.stringify({
      userId: 1,
      role: 'department-admin',
      name: 'Fire Chief Mendoza',
      email: 'mendoza@fire.dagupan.gov',
      department: 'Bureau of Fire Protection (BFP Dagupan)',
      departmentId: 1,
    }));
  });

  test('renders real DepartmentDashboardPage without crashing', async () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <DepartmentDashboardPage />
        </ThemeProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Department Dashboard')).toBeInTheDocument();
    });
  });
});
