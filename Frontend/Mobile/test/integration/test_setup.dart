import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Shared setup for integration tests.
/// Call from setUpAll() in test files that need SharedPreferences or AppConfig.
Future<void> setupIntegrationTest() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({});
  await dotenv.load(fileName: '.env');
}
