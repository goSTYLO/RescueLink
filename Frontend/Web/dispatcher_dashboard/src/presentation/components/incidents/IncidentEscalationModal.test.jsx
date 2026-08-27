import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IncidentEscalationModal } from './IncidentEscalationModal';

describe('IncidentEscalationModal', () => {
  const mockDepartments = [
    { department_id: 1, name: 'BFP Dagupan', type: 'Fire', status: 'active' },
    { department_id: 2, name: 'PNP Dagupan', type: 'Police', status: 'active' },
    { department_id: 3, name: 'CDRRMO', type: 'Rescue', status: 'active' },
  ];

  it('renders without crashing when open is true', () => {
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
    expect(screen.getByLabelText(/Target Department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Urgency Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Justification \/ Notes/i)).toBeInTheDocument();
  });

  it('filters out own department from the options', () => {
    render(
      <IncidentEscalationModal
        open={true}
        onOpenChange={jest.fn()}
        departments={mockDepartments}
        ownDepartmentId={1}
        onSubmit={jest.fn()}
      />
    );

    // Open target department dropdown
    const trigger = screen.getByLabelText(/Target Department/i);
    fireEvent.click(trigger);

    // Should contain PNP and CDRRMO, but not BFP (own department)
    expect(screen.getByText('PNP Dagupan · Police')).toBeInTheDocument();
    expect(screen.getByText('CDRRMO · Rescue')).toBeInTheDocument();
    expect(screen.queryByText('BFP Dagupan · Fire')).not.toBeInTheDocument();
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

    // Select target department
    const deptTrigger = screen.getByLabelText(/Target Department/i);
    fireEvent.click(deptTrigger);
    fireEvent.click(screen.getByText('PNP Dagupan · Police'));

    // Fill notes
    const textarea = screen.getByPlaceholderText(/Describe why assistance is needed/i);
    fireEvent.change(textarea, { target: { value: 'Need police traffic management urgently.' } });

    // Submit
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
