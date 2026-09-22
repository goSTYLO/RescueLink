import { incidentTableRowClickProps } from './incidentDashboardTable';

describe('incidentTableRowClickProps', () => {
  test('navigates on row click outside interactive controls', () => {
    const navigate = jest.fn();
    const { onClick } = incidentTableRowClickProps({ id: 42 }, navigate);
    const cell = document.createElement('td');
    cell.textContent = 'Barangay';
    onClick({ target: cell });
    expect(navigate).toHaveBeenCalledWith('/incidents/42');
  });

  test('does not navigate when click originates from a button', () => {
    const navigate = jest.fn();
    const { onClick } = incidentTableRowClickProps({ id: 42 }, navigate);
    const button = document.createElement('button');
    button.textContent = 'Archive';
    onClick({ target: button });
    expect(navigate).not.toHaveBeenCalled();
  });
});
