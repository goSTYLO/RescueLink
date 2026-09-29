import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/screens/auth/create_new_password_screen.dart';
import 'package:rescuelink_mobile/screens/auth/forgot_password_screen.dart';
import 'package:rescuelink_mobile/screens/auth/identity_error_screen.dart';
import 'package:rescuelink_mobile/screens/auth/password_updated_screen.dart';
import 'package:rescuelink_mobile/screens/auth/verified_screen.dart';
import 'package:rescuelink_mobile/screens/auth/verify_number_screen.dart';
import 'package:rescuelink_mobile/theme/app_theme.dart';

Widget _wrapDark(Widget child) {
  return MaterialApp(
    theme: AppTheme.darkTheme,
    home: child,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Forgot-password flow dark theme smoke', () {
    testWidgets('ForgotPasswordScreen builds under dark theme', (tester) async {
      await tester.pumpWidget(_wrapDark(const ForgotPasswordScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text("I'm not a robot"), findsOneWidget);
    });

    testWidgets('VerifyNumberScreen builds under dark theme', (tester) async {
      await tester.pumpWidget(
        _wrapDark(const VerifyNumberScreen(phoneNumber: '09171234567')),
      );
      await tester.pump();
      expect(find.text('09171234567'), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(6));
      // Drain resend countdown so teardown has no pending timers.
      await tester.pump(const Duration(seconds: 45));
    });

    testWidgets('CreateNewPasswordScreen builds under dark theme', (tester) async {
      await tester.pumpWidget(
        _wrapDark(
          const CreateNewPasswordScreen(phoneNumber: '09171234567'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('New Password'), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(2));
    });

    testWidgets('VerifiedScreen builds under dark theme', (tester) async {
      await tester.pumpWidget(_wrapDark(const VerifiedScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Verified'), findsOneWidget);
    });

    testWidgets('PasswordUpdatedScreen builds under dark theme', (tester) async {
      await tester.pumpWidget(_wrapDark(const PasswordUpdatedScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Password Updated!'), findsOneWidget);
    });

    testWidgets('IdentityErrorScreen builds under dark theme', (tester) async {
      await tester.pumpWidget(_wrapDark(const IdentityErrorScreen()));
      await tester.pumpAndSettle();
      expect(find.text('OH NO...'), findsOneWidget);
    });
  });
}
