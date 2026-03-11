import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login from '@/presentation/pages/Login';

jest.mock('@/presentation/assets/logo.svg', () => 'logo.svg');
jest.mock('@/presentation/assets/illustration.svg', () => 'illustration.svg');
jest.mock('@/presentation/components/layout/AuthCardLayout', () => ({
  AuthCardLayout: ({ children }) => <div>{children}</div>,
}));
jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
  MAPBOX_ACCESS_TOKEN: '',
}));
jest.mock('sweetalert2', () => ({ fire: jest.fn(() => Promise.resolve()) }));
jest.mock('@/data/api/auth.api', () => ({
  loginDispatcher: jest.fn(),
  verifyDispatcherOtp: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const { loginDispatcher, verifyDispatcherOtp } = require('@/data/api/auth.api');

describe('Login page interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('successful login stores token and calls onSuccess', async () => {
    loginDispatcher.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { role: 'super-admin', firstName: 'A', lastName: 'B' },
    });

    const onSuccess = jest.fn();
    render(<Login onSuccess={onSuccess} onForgotPasswordClick={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dispatcher@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(loginDispatcher).toHaveBeenCalled());
    expect(sessionStorage.getItem('token')).toBe('jwt-token');
    expect(onSuccess).toHaveBeenCalled();
  });

  test('mfa path prompts OTP then verifies', async () => {
    loginDispatcher.mockResolvedValueOnce({
      sessionToken: 'session-otp-token',
      message: 'Enter code.',
    });
    verifyDispatcherOtp.mockResolvedValueOnce({
      token: 'verified-jwt',
      user: { role: 'super-admin', firstName: 'A', lastName: 'B' },
    });

    const onSuccess = jest.fn();
    render(<Login onSuccess={onSuccess} onForgotPasswordClick={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dispatcher@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(loginDispatcher).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Enter 6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(verifyDispatcherOtp).toHaveBeenCalledWith('session-otp-token', '123456'));
    expect(sessionStorage.getItem('token')).toBe('verified-jwt');
    expect(onSuccess).toHaveBeenCalled();
  });
});
