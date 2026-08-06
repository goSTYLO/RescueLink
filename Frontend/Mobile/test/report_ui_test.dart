import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/report_ui.dart';

void main() {
  group('ReportStatusUi', () {
    test('normalizes in_progress without collapsing to verified', () {
      expect(ReportStatusUi.normalize('in_progress'), 'in_progress');
      expect(ReportStatusUi.label('in_progress'), 'In Progress');
      expect(ReportStatusUi.isResolved('in_progress'), isFalse);
    });

    test('keeps resolved state and label', () {
      expect(ReportStatusUi.normalize('resolved'), 'resolved');
      expect(ReportStatusUi.label('resolved'), 'Resolved');
      expect(ReportStatusUi.isResolved('resolved'), isTrue);
    });
  });
}
