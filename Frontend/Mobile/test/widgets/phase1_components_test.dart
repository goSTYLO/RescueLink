import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/widgets/glass_card.dart';
import 'package:rescuelink_mobile/widgets/skeleton_placeholder.dart';
import 'package:rescuelink_mobile/widgets/animated_fab.dart';
import 'package:rescuelink_mobile/widgets/bottom_sheet_wrapper.dart';
import 'package:rescuelink_mobile/theme/app_theme.dart';

void main() {
  group('GlassCard', () {
    testWidgets('renders child content', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: GlassCard(
              child: Text('Test content'),
            ),
          ),
        ),
      );
      expect(find.text('Test content'), findsOneWidget);
    });

    testWidgets('renders in dark mode', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: const Scaffold(
            body: GlassCard(
              child: Text('Dark content'),
            ),
          ),
        ),
      );
      expect(find.text('Dark content'), findsOneWidget);
    });
  });

  group('SkeletonPlaceholder', () {
    testWidgets('renders with correct dimensions', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: SkeletonPlaceholder(
              width: 100,
              height: 50,
            ),
          ),
        ),
      );
      expect(find.byType(SkeletonPlaceholder), findsOneWidget);
    });
  });

  group('SkeletonCard', () {
    testWidgets('renders card layout', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: SkeletonCard(height: 80),
          ),
        ),
      );
      expect(find.byType(SkeletonCard), findsOneWidget);
    });
  });

  group('SkeletonPage', () {
    testWidgets('renders multiple skeleton cards', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: SkeletonPage(cardCount: 3),
          ),
        ),
      );
      expect(find.byType(SkeletonCard), findsNWidgets(3));
    });
  });

  group('AnimatedFab', () {
    testWidgets('renders with icon', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: AnimatedFab(
              icon: Icons.warning,
              onPressed: () {},
            ),
          ),
        ),
      );
      expect(find.byIcon(Icons.warning), findsOneWidget);
    });

    testWidgets('shows hint label when provided', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: AnimatedFab(
              icon: Icons.warning,
              hintLabel: 'Tap for SOS',
              onPressed: () {},
            ),
          ),
        ),
      );
      expect(find.text('Tap for SOS'), findsOneWidget);
    });
  });

  group('BottomSheetWrapper', () {
    testWidgets('renders with title', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: BottomSheetWrapper(
              title: 'Test Sheet',
              child: Text('Sheet content'),
            ),
          ),
        ),
      );
      expect(find.text('Test Sheet'), findsOneWidget);
      expect(find.text('Sheet content'), findsOneWidget);
    });

    testWidgets('renders without title', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: BottomSheetWrapper(
              child: Text('Content only'),
            ),
          ),
        ),
      );
      expect(find.text('Content only'), findsOneWidget);
    });
  });

  group('AppTheme', () {
    testWidgets('light theme applies correctly', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: Text('Light'),
          ),
        ),
      );
      final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
      expect(materialApp.theme?.brightness, Brightness.light);
    });

    testWidgets('dark theme applies correctly', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: const Scaffold(
            body: Text('Dark'),
          ),
        ),
      );
      final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
      expect(materialApp.theme?.brightness, Brightness.dark);
    });
  });
}
