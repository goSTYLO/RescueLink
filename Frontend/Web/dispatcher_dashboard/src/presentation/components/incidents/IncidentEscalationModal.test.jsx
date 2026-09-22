import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IncidentEscalationModal } from './IncidentEscalationModal';
import { getResponderTeams } from '@/data/api/responders.api';

jest.mock('@/data/api/responders.api', () => ({
  getResponderTeams: jest.fn(),
}));

/** antd Select combobox associated with a visible <label htmlFor>. */
function getSelectByLabel(label) {
  return screen.getByRole('combobox', { name: label });
}

/** antd Select: open dropdown then pick an option (renders in a portal). */
function selectOption(combobox, optionText) {
  fireEvent.mouseDown(combobox);
  const dropdown = document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  const option = within(dropdown).getByText(optionText);
  fireEvent.click(option);
}

describe('IncidentEscalationModal', () => {
  const mockDepartments = [
    { department_id: 1, name: 'BFP Dagupan', code: 'bfp', type: 'Fire', status: 'active' },
    { department_id: 2, name: 'PNP Dagupan', code: 'pnp', type: 'Police', status: 'active' },
    { department_id: 3, name: 'CDRRMO', code: 'cdrrmo', type: 'Rescue', status: 'active' },
  ];

  const mockTeams = [
    { team_id: 101, team_name: 'Patrol Alpha', department_code: 'pnp', team_status: 'Available', supported_incident_types: ['police', 'accident'] },
    { team_id: 102, team_name: 'Traffic Bravo', department_code: 'pnp', team_status: 'Busy', supported_incident_types: ['accident'] },
    { team_id: 103, team_name: 'Rescue One', department_code: 'cdrrmo', team_status: 'Available', supported_incident_types: ['disaster', 'medical'] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getResponderTeams.mockResolvedValue(mockTeams);
  });

  it('renders without crashing when open is true', async () => {
    render(
      <IncidentEscalationModal
        open={true}
        onOpenChange={jest.fn()}
        departments={mockDepartments}
        ownDepartmentId={1}
        onSubmit={jest.fn()}
      />
    );

    expect(screen.getByText('Request Inter-Department Assistance')).toBeInTheDocument();
    expect(getSelectByLabel(/Target Department/i)).toBeInTheDocument();
    expect(getSelectByLabel(/Urgency Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Justification \/ Notes/i)).toBeInTheDocument();
    await waitFor(() => expect(getResponderTeams).toHaveBeenCalled());
  });

  it('filters out own department from the options', async () => {
    render(
      <IncidentEscalationModal
        open={true}
        onOpenChange={jest.fn()}
        departments={mockDepartments}
        ownDepartmentId={1}
        onSubmit={jest.fn()}
      />
    );

    await waitFor(() => expect(getResponderTeams).toHaveBeenCalled());

    fireEvent.mouseDown(getSelectByLabel(/Target Department/i));

    const dropdown = document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    expect(dropdown).toBeTruthy();
    expect(within(dropdown).getByText('PNP Dagupan · Police')).toBeInTheDocument();
    expect(within(dropdown).getByText('CDRRMO · Rescue')).toBeInTheDocument();
    expect(within(dropdown).queryByText('BFP Dagupan · Fire')).not.toBeInTheDocument();
  });

  it('displays available teams when a department is selected', async () => {
    render(
      <IncidentEscalationModal
        open={true}
        onOpenChange={jest.fn()}
        departments={mockDepartments}
        ownDepartmentId={1}
        onSubmit={jest.fn()}
      />
    );

    selectOption(getSelectByLabel(/Target Department/i), 'PNP Dagupan · Police');

    await waitFor(() => {
      expect(screen.getByText(/PNP Dagupan Resources/i)).toBeInTheDocument();
      expect(screen.getByText('Patrol Alpha')).toBeInTheDocument();
      expect(screen.getByText('Traffic Bravo')).toBeInTheDocument();
      expect(screen.getByText(/ready to respond/i)).toBeInTheDocument();
    });
  });

  it('shows empty team message when department has no registered teams', async () => {
    getResponderTeams.mockResolvedValueOnce([]);

    render(
      <IncidentEscalationModal
        open={true}
        onOpenChange={jest.fn()}
        departments={mockDepartments}
        ownDepartmentId={1}
        onSubmit={jest.fn()}
      />
    );

    selectOption(getSelectByLabel(/Target Department/i), 'CDRRMO · Rescue');

    await waitFor(() => {
      expect(screen.getByText(/No registered responder teams found for this department/i)).toBeInTheDocument();
    });
  });

  it('submits valid escalation payload correctly', async () => {
    const mockSubmit = jest.fn().mockResolvedValue({});
    const mockOpenChange = jest.fn();

    render(
      <IncidentEscalationModal
        open={true}
        onOpenChange={mockOpenChange}
        departments={mockDepartments}
        ownDepartmentId={1}
        onSubmit={mockSubmit}
      />
    );

    selectOption(getSelectByLabel(/Target Department/i), 'PNP Dagupan · Police');

    const textarea = screen.getByPlaceholderText(/Describe why assistance is needed/i);
    fireEvent.change(textarea, { target: { value: 'Need police traffic management urgently.' } });

    const sendButton = screen.getByRole('button', { name: /Send Request/i });
    expect(sendButton).not.toBeDisabled();
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        to_department_id: 2,
        urgency: 'medium',
        justification_notes: 'Need police traffic management urgently.',
      });
      expect(mockOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
