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

  group('assignedDepartmentTeamEntries', () {
    test('dedupes team member dispatches into one lead department entry', () {
      final incident = {
        'assigned_team_name': 'Rescue Alpha',
        'dispatches': [
          {
            'department_name': 'DRRMO',
            'team_name': 'Rescue Alpha',
            'responder_id': 1,
            'responder_name': 'Member One',
            'response_status': 'En Route',
          },
          {
            'department_name': 'DRRMO',
            'team_name': 'Rescue Alpha',
            'responder_id': 2,
            'responder_name': 'Member Two',
            'response_status': 'En Route',
          },
        ],
      };

      final entries = assignedDepartmentTeamEntries(incident);
      expect(entries.length, 1);
      expect(entries.first.isLead, isTrue);
      expect(entries.first.teamName, 'Rescue Alpha');
      expect(hasAssistingDepartments(incident), isFalse);
    });

    test('shows assisting department only for escalation dispatches', () {
      final incident = {
        'dispatches': [
          {
            'department_name': 'DRRMO',
            'team_name': 'Rescue Alpha',
            'responder_id': 1,
            'responder_source': 'account',
          },
          {
            'department_name': 'PNP',
            'team_name': 'Patrol Alpha',
            'responder_id': 2,
            'responder_source': 'escalation',
          },
        ],
      };

      final entries = assignedDepartmentTeamEntries(incident);
      expect(entries.length, 2);
      expect(entries.first.isLead, isTrue);
      expect(entries.last.isLead, isFalse);
      expect(hasAssistingDepartments(incident), isTrue);
    });
  });

  group('ReportStatusUi.isResponderDetailReadOnly', () {
    test('team assignment is read-only when incident is closed', () {
      expect(
        ReportStatusUi.isResponderDetailReadOnly(
          {'status': 'closed', 'my_response_status': 'On Scene'},
          isTeamAssignment: true,
        ),
        isTrue,
      );
    });

    test('team assignment is read-only when member dispatch is resolved', () {
      expect(
        ReportStatusUi.isResponderDetailReadOnly(
          {'status': 'in_progress', 'my_response_status': 'Resolved'},
          isTeamAssignment: true,
        ),
        isTrue,
      );
    });

    test('volunteer assignment is read-only when responder_status is resolved', () {
      expect(
        ReportStatusUi.isResponderDetailReadOnly(
          {'status': 'in_progress', 'responder_status': 'Resolved'},
        ),
        isTrue,
      );
    });
  });

  group('assignedTeamRoster', () {
    test('reads roster from assigned_team_roster payload', () {
      final roster = assignedTeamRoster({
        'assigned_team_roster': [
          {'name': 'Ana Cruz', 'response_status': 'En Route'},
          {'name': 'Ben Santos', 'response_status': 'En Route'},
        ],
      });
      expect(roster.length, 2);
      expect(roster.first.name, 'Ana Cruz');
    });
  });
}
