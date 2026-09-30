import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/sos_vibration.dart';

void main() {
  test('one full-strength beat per countdown second', () {
    final timings = sosVibrationTimings();
    final sum = timings.fold<int>(0, (total, ms) => total + ms);
    expect(timings.first, 0);
    expect(timings.length, 1 + sosCountdownBeats * 2);
    expect(timings[1], sosBeatOnMs);
    expect(timings[2], sosBeatOffMs);
    expect(sosBeatOnMs + sosBeatOffMs, 1000);
    expect(sum, sosCountdownBeats * 1000);
  });
}
