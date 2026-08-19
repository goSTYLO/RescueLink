import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GlobalSearch } from '@/presentation/components/common/GlobalSearch';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@/presentation/context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

jest.mock('@/core/config/app.config', () => ({
  DEV_MODE: true,
  API_URL: 'http://localhost:3000',
}));

jest.mock('@/data/api/incidents.api', () => ({
  getIncidents: jest.fn(),
}));

describe('GlobalSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('shows mock incident results after debounced search in dev mode without token', async () => {
    render(<GlobalSearch />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Bonuan' } });

    await waitFor(() => {
      expect(screen.getByText('Incident #INC-2026-001')).toBeInTheDocument();
    });
  });

  test('navigates to incident details when Enter selects a result', async () => {
    render(<GlobalSearch />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Pantal' } });

    await waitFor(() => {
      expect(screen.getByText('Incident #INC-2026-002')).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/incidents/INC-2026-002');
  });
});
