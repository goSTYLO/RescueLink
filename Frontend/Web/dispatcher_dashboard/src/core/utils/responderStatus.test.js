import { responderStatusTagColor } from '@/core/utils/responderStatus';

describe('responderStatusTagColor', () => {
  test('maps availability and volunteer statuses', () => {
    expect(responderStatusTagColor('available')).toBe('green');
    expect(responderStatusTagColor('Standby')).toBe('gold');
    expect(responderStatusTagColor('busy')).toBe('red');
    expect(responderStatusTagColor('off-duty')).toBe('default');
    expect(responderStatusTagColor('en route')).toBe('gold');
    expect(responderStatusTagColor('on scene')).toBe('orange');
    expect(responderStatusTagColor('assigned')).toBe('blue');
    expect(responderStatusTagColor('resolved')).toBe('green');
    expect(responderStatusTagColor('')).toBe('default');
  });
});
