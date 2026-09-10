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

}
