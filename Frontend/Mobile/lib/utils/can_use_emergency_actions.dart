/// Whether SOS / Report Incident may run for the current location check.
///
/// Fail closed: unknown (`null`) location is locked unless [bypass] is true.
bool canUseEmergencyActions({
  required bool? inServiceArea,
  required bool bypass,
}) {
  if (bypass) return true;
  return inServiceArea == true;
}
