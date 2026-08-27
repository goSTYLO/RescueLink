jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
  ONESIGNAL_APP_ID: 'test-app-id-123',
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationPromptBanner, PROMPT_DISMISSED_KEY } from './NotificationPromptBanner';
import * as oneSignalService from '@/core/services/oneSignalWebService';
import { ThemeProvider } from '@/presentation/context/ThemeContext';

jest.mock('@/core/services/oneSignalWebService');

describe('NotificationPromptBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  const renderWithTheme = (component) => {
    return render(<ThemeProvider>{component}</ThemeProvider>);
  };

  test('renders prompt banner when permission state is default', async () => {
    oneSignalService.getPushNotificationState.mockResolvedValue('default');

    renderWithTheme(<NotificationPromptBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Enable Real-time Push Notifications/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Enable Notifications/i })).toBeInTheDocument();
  });

  test('does not render when permission is already granted', async () => {
    oneSignalService.getPushNotificationState.mockResolvedValue('granted');

    renderWithTheme(<NotificationPromptBanner />);

    await waitFor(() => {
      expect(screen.queryByText(/Enable Real-time Push Notifications/i)).not.toBeInTheDocument();
    });
  });

  test('does not render if previously dismissed in localStorage', async () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    oneSignalService.getPushNotificationState.mockResolvedValue('default');

    renderWithTheme(<NotificationPromptBanner />);

    await waitFor(() => {
      expect(screen.queryByText(/Enable Real-time Push Notifications/i)).not.toBeInTheDocument();
    });
  });

  test('calls requestPushPermission on enable click and stores dismissal', async () => {
    oneSignalService.getPushNotificationState.mockResolvedValue('default');
    oneSignalService.requestPushPermission.mockResolvedValue(true);

    const onStatusChange = jest.fn();
    renderWithTheme(<NotificationPromptBanner onStatusChange={onStatusChange} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enable Notifications/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Enable Notifications/i }));

    await waitFor(() => {
      expect(oneSignalService.requestPushPermission).toHaveBeenCalledTimes(1);
      expect(onStatusChange).toHaveBeenCalledWith('granted');
      expect(localStorage.getItem(PROMPT_DISMISSED_KEY)).toBe('true');
    });
  });

  test('dismisses and saves to localStorage on close button click', async () => {
    oneSignalService.getPushNotificationState.mockResolvedValue('default');

    renderWithTheme(<NotificationPromptBanner />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Dismiss notification prompt/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/Dismiss notification prompt/i));

    expect(localStorage.getItem(PROMPT_DISMISSED_KEY)).toBe('true');
    expect(screen.queryByText(/Enable Real-time Push Notifications/i)).not.toBeInTheDocument();
  });
});
