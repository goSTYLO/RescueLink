import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/incident_navigation.dart';

void main() {
  group('computeInvolvement', () {
    test('uses API involvement when present', () {
      expect(
        computeInvolvement({'involvement': 'accepted'}, 5),
        'accepted',
      );
    });

    test('derives reported from user_id', () {
      expect(
        computeInvolvement({'user_id': 5, 'accepted_by_user_id': null}, 5),
        'reported',
      );
    });

    test('derives accepted from accepted_by_user_id', () {
      expect(
        computeInvolvement({'user_id': 2, 'accepted_by_user_id': 7}, 7),
        'accepted',
      );
    });

    test('derives both when user reported and accepted', () {
      expect(
        computeInvolvement({'user_id': 9, 'accepted_by_user_id': 9}, 9),
        'both',
      );
    });
  });

  group('shouldOpenResponderDetail', () {
    test('accepted always opens responder detail', () {
      expect(
        shouldOpenResponderDetail(involvement: 'accepted'),
        isTrue,
      );
    });

    test('both opens responder detail only under accepted filter', () {
      expect(
        shouldOpenResponderDetail(involvement: 'both', involvementFilter: 'accepted'),
        isTrue,
      );
      expect(
        shouldOpenResponderDetail(involvement: 'both', involvementFilter: 'all'),
        isFalse,
      );
    });

    test('reported opens citizen detail', () {
      expect(
        shouldOpenResponderDetail(involvement: 'reported'),
        isFalse,
      );
    });

    test('assigned opens responder detail', () {
      expect(
        shouldOpenResponderDetail(involvement: 'assigned'),
        isTrue,
      );
    });
  });

  group('shouldOpenVolunteerPreview', () {
    test('nearby volunteer with no involvement opens preview', () {
      expect(
        shouldOpenVolunteerPreview(isVolunteer: true, involvement: null),
        isTrue,
      );
    });

    test('reporter and accepted volunteer do not open preview', () {
      expect(
        shouldOpenVolunteerPreview(isVolunteer: true, involvement: 'reported'),
        isFalse,
      );
      expect(
        shouldOpenVolunteerPreview(isVolunteer: true, involvement: 'accepted'),
        isFalse,
      );
    });

    test('non-volunteer never opens preview', () {
      expect(
        shouldOpenVolunteerPreview(isVolunteer: false, involvement: null),
        isFalse,
      );
    });
  });

  test('personnel report-id open returns before citizen AI fallback', () {
    final src = File('lib/utils/incident_navigation.dart').readAsStringSync();
    final personnel = src.indexOf('if (AuthService().isPersonnelResponder)');
    final openDetail = src.indexOf('_openPersonnelIncidentDetail', personnel);
    final personnelReturn = src.indexOf('return;', openDetail);
    final aiFallback = src.indexOf('getIncidentWithAiFallback');
    expect(personnel, greaterThan(-1));
    expect(openDetail, greaterThan(personnel));
    expect(personnelReturn, greaterThan(openDetail));
    expect(personnelReturn, lessThan(aiFallback));
  });
}
