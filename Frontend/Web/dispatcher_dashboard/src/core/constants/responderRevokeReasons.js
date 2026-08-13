/**
 * Predefined revoke reasons — mirrors Backend/src/constants/responderRevokeReasons.js
 */

export const REVOKE_REASONS = [
  { value: 'no_longer_qualified', label: 'No longer qualified' },
  { value: 'repeated_no_shows', label: 'Repeated no-shows' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'user_requested_removal', label: 'User requested removal' },
  { value: 'other', label: 'Other' },
];

export const SWAL_PRIMARY = '#134178';
