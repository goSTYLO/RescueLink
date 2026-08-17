import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/report_ui.dart';

void main() {
  test('incidentTypesFrom prefers incident_types array', () {
    final types = incidentTypesFrom({
      'incident_type': 'medical',
      'incident_types': ['fire', 'medical'],
    });
    expect(types, ['fire', 'medical']);
  });

  test('incidentTypesFrom falls back to primary and secondary', () {
    final types = incidentTypesFrom({
      'incident_type': 'medical',
      'secondary_classification': 'fire',
    });
    expect(types, ['medical', 'fire']);
  });

  test('incidentTypesLabel joins labels with middle dot', () {
    final label = incidentTypesLabel({
      'incident_types': ['medical', 'fire'],
    });
    expect(label, 'Medical · Fire');
  });

  test('primaryIncidentType returns first ranked type', () {
    final primary = primaryIncidentType({
      'incident_types': ['fire', 'medical'],
      'incident_type': 'medical',
    });
    expect(primary, 'fire');
  });

  test('aiClassificationTypesFrom prefers incident payload', () {
    final types = aiClassificationTypesFrom(
      {'incident_types': ['medical', 'fire']},
      {'incident_types': ['police']},
    );
    expect(types, ['medical', 'fire']);
  });

  test('aiClassificationTypesFrom merges from ai classification when incident empty', () {
    final types = aiClassificationTypesFrom(
      {},
      {'incident_types': ['medical', 'fire']},
    );
    expect(types, ['medical', 'fire']);
  });

  test('incidentTypeColor maps known types', () {
    expect(incidentTypeColor('fire'), const Color(0xFFEA580C));
    expect(incidentTypeColor('medical'), const Color(0xFFEC4899));
  });
}
