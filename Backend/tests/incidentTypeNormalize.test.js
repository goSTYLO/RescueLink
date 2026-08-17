const {
  normalizeAiIncidentType,
  normalizeAiIncidentTypes,
  incidentTypesFromRow,
} = require('../src/utils/incidentTypeNormalize');

describe('incidentTypeNormalize', () => {
  it('normalizes AI labels to backend values', () => {
    expect(normalizeAiIncidentType('Fire')).toBe('fire');
    expect(normalizeAiIncidentType('Medical')).toBe('medical');
    expect(normalizeAiIncidentType('Crime')).toBe('police');
    expect(normalizeAiIncidentType('Natural Disaster')).toBe('disaster');
    expect(normalizeAiIncidentType('Accident')).toBe('accident');
  });

  it('deduplicates normalized incident types preserving order', () => {
    expect(normalizeAiIncidentTypes(['Medical', 'Fire', 'Medical'])).toEqual(['medical', 'fire']);
  });

  it('builds incident_types from legacy primary and secondary fields', () => {
    expect(incidentTypesFromRow({
      incident_type: 'medical',
      secondary_classification: 'fire',
    })).toEqual(['medical', 'fire']);
  });

  it('prefers incident_types array when present', () => {
    expect(incidentTypesFromRow({
      incident_type: 'medical',
      incident_types: ['fire', 'medical'],
    })).toEqual(['fire', 'medical']);
  });
});

describe('aiService mapAiClassificationResult', () => {
  it('maps ranked AI types to normalized primary and secondary', () => {
    const { mapAiClassificationResult } = require('../src/services/aiService')._internal;
    const mapped = mapAiClassificationResult({
      incident_types: ['Medical', 'Fire'],
      severity: 'Red',
      confidence_scores: { Medical: 0.87, Fire: 0.38 },
      keyword_promoted: true,
    });

    expect(mapped.incidentTypes).toEqual(['medical', 'fire']);
    expect(mapped.primaryType).toBe('medical');
    expect(mapped.secondaryType).toBe('fire');
    expect(mapped.keywordPromoted).toBe(true);
    expect(mapped.severity).toBe('high');
  });
});
