import { fireEvent, render, screen } from '@testing-library/react';
import { ChartCard } from './ChartCard';

describe('ChartCard export actions', () => {
  it('renders Excel and PDF buttons and calls handlers', () => {
    const onExportExcel = jest.fn();
    const onExportPdf = jest.fn();
    render(
      <ChartCard
        title="Peak demand"
        exportChartId="peak"
        onExportExcel={onExportExcel}
        onExportPdf={onExportPdf}
      >
        <p>content</p>
      </ChartCard>,
    );
    const root = document.querySelector('[data-insights-chart="peak"]');
    expect(root).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Export Peak demand to Excel/i }));
    fireEvent.click(screen.getByRole('button', { name: /Download Peak demand as PDF/i }));
    expect(onExportExcel).toHaveBeenCalledTimes(1);
    expect(onExportPdf).toHaveBeenCalledTimes(1);
  });
});
