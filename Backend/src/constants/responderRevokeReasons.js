/**
 * Predefined revoke reasons for volunteer first-responder role removal.
 */

const REVOKE_REASONS = {
  NO_LONGER_QUALIFIED: 'no_longer_qualified',
  REPEATED_NO_SHOWS: 'repeated_no_shows',
  SAFETY_CONCERN: 'safety_concern',
  USER_REQUESTED_REMOVAL: 'user_requested_removal',
  OTHER: 'other',
};

const REVOKE_REASON_LABELS = {
  [REVOKE_REASONS.NO_LONGER_QUALIFIED]: 'No longer qualified',
  [REVOKE_REASONS.REPEATED_NO_SHOWS]: 'Repeated no-shows',
  [REVOKE_REASONS.SAFETY_CONCERN]: 'Safety concern',
  [REVOKE_REASONS.USER_REQUESTED_REMOVAL]: 'User requested removal',
  [REVOKE_REASONS.OTHER]: 'Other',
};

const VALID_REVOKE_REASON_CODES = Object.values(REVOKE_REASONS);

function getRevokeReasonLabel(code) {
  return REVOKE_REASON_LABELS[code] || code;
}

function formatRevokeNotes(reasonCode, reasonOther) {
  const label = getRevokeReasonLabel(reasonCode);
  if (reasonCode === REVOKE_REASONS.OTHER && reasonOther) {
    return `${label}: ${reasonOther.trim()}`;
  }
  return label;
}

module.exports = {
  REVOKE_REASONS,
  REVOKE_REASON_LABELS,
  VALID_REVOKE_REASON_CODES,
  getRevokeReasonLabel,
  formatRevokeNotes,
};
