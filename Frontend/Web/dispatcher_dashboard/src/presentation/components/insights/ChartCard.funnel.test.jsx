import { render } from '@testing-library/react';
import { EscalationFunnelSteps, funnelTrapezoidClipPath } from './ChartCard';

describe('funnelTrapezoidClipPath', () => {
  it('narrows from top width to bottom width (reverse pyramid)', () => {
    const clip = funnelTrapezoidClipPath(100, 83.3);
    expect(clip).toMatch(/^polygon\(/);
    expect(clip).toContain('0% 0');
    expect(clip).toContain('100% 0');
    const bottomLeft = (100 - 83.3) / 2;
    expect(clip).toContain(`${bottomLeft}% 100%`);
  });
});

describe('EscalationFunnelSteps', () => {
  it('stacks trapezoid steps with top stage widest', () => {
    render(
      <EscalationFunnelSteps
        rows={[
          { label: 'Escalated', count: 6, pct: 100 },
          { label: 'Accepted', count: 5, pct: 83.3 },
          { label: 'Dispatched', count: 5, pct: 83.3 },
          { label: 'Arrived', count: 5, pct: 83.3 },
        ]}
      />
    );
    const steps = document.querySelectorAll('.insights-funnel-step');
    expect(steps).toHaveLength(4);
    expect(steps[0].style.clipPath).toContain('0% 0');
    expect(steps[0].style.clipPath).toContain('100% 0');
    expect(steps[1].style.clipPath).toBe(funnelTrapezoidClipPath(83.3, 83.3));
  });
});
