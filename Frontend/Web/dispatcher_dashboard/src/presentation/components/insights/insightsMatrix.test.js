const {
  matrixIntensityStep,
  buildTypeBarangayMatrix,
  matrixCellStyle,
  matrixCellBackground,
} = require('./insightsMatrix');

describe('insightsMatrix', () => {
  it('gives a higher count a stronger intensity step', () => {
    expect(matrixIntensityStep(1, 10)).toBeLessThan(matrixIntensityStep(9, 10));
    expect(matrixIntensityStep(0, 10)).toBe(0);
    expect(matrixIntensityStep(10, 10)).toBe(4);
  });

  it('keeps the busiest barangays as columns', () => {
    const matrix = buildTypeBarangayMatrix([
      { incident_type: 'fire', barangay: 'Pantal', count: 2 },
      { incident_type: 'fire', barangay: 'Bonuan', count: 9 },
      { incident_type: 'medical', barangay: 'Bonuan', count: 4 },
    ], 1);
    expect(matrix.barangays).toEqual(['Bonuan']);
    expect(matrix.lookup.get('fire|Bonuan')).toBe(9);
    expect(matrix.max).toBe(9);
  });

  it('uses stronger fill for higher counts', () => {
    const low = matrixCellBackground(2, 10, false);
    const high = matrixCellBackground(10, 10, false);
    expect(high).not.toBe(low);
    expect(parseFloat(high.match(/[\d.]+(?=\)$)/)?.[0] || 0))
      .toBeGreaterThan(parseFloat(low.match(/[\d.]+(?=\)$)/)?.[0] || 0));
  });

  it('tints the cell square by type, not the numeral', () => {
    const style = matrixCellStyle(2, 10, true, '#ea580c');
    expect(style.fontWeight).toBe(600);
    expect(style.backgroundColor).toMatch(/234,\s*88,\s*12/);
    expect(style.color).not.toBe('#ea580c');
    expect(matrixCellStyle(0, 10, true, '#ea580c')).toEqual({ backgroundColor: 'transparent' });
  });
});
