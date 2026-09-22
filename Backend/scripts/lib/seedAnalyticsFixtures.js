/** Pure helpers for analytics-rich seed-db (Insights / getOverview). */

const DEFAULT_INCIDENT_COUNT = 300;
const DEFAULT_SEED_SPAN_DAYS = 90;

const DISPATCH_TARGET_SEC = 8 * 60;
const ARRIVAL_TARGET_SEC = 10 * 60;

function parseSeedCli(argv = process.argv.slice(2)) {
  const countArg = argv.find((arg) => arg.startsWith('--count='));
  const daysArg = argv.find((arg) => arg.startsWith('--days='));
  const parsedCount = countArg ? Number(countArg.split('=')[1]) : DEFAULT_INCIDENT_COUNT;
  const parsedDays = daysArg ? Number(daysArg.split('=')[1]) : DEFAULT_SEED_SPAN_DAYS;
  const incidentCount = Number.isFinite(parsedCount) && parsedCount > 0
    ? Math.min(Math.floor(parsedCount), 2000)
    : DEFAULT_INCIDENT_COUNT;
  const spanDays = Number.isFinite(parsedDays) && parsedDays > 0
    ? Math.min(Math.floor(parsedDays), 366)
    : DEFAULT_SEED_SPAN_DAYS;
  return { incidentCount, spanDays };
}

function departmentCodeForType(incidentType) {
  const t = String(incidentType || '').toLowerCase();
  if (t === 'police') return 'pnp';
  return 'drrmo';
}

function teamNameForDepartmentAndType(departmentCode, incidentType) {
  const t = String(incidentType || '').toLowerCase();
  if (departmentCode === 'pnp') return 'Patrol Alpha';
  if (t === 'fire') return 'Fire Support';
  if (t === 'medical') return 'Medical Alpha';
  if (t === 'accident') return 'Emergency Response Alpha';
  if (t === 'disaster') return 'Rescue Alpha';
  return 'Emergency Response Alpha';
}

/** @returns {'sos'|'voice'|'text'} */
function channelKindForIndex(i) {
  const slot = i % 100;
  if (slot < 10) return 'sos';
  if (slot < 65) return 'voice';
  return 'text';
}

/** @returns {{ status: string, verified: boolean, closureMethod: string|null }} */
function statusProfileForIndex(i) {
  const slot = i % 100;
  if (slot < 10) {
    return { status: 'pending', verified: false, closureMethod: null };
  }
  if (slot < 15) {
    return { status: 'verified', verified: true, closureMethod: null };
  }
  if (slot < 20) {
    return { status: 'in_progress', verified: true, closureMethod: null };
  }
  if (slot < 75) {
    return { status: 'resolved', verified: true, closureMethod: 'Resolved on scene' };
  }
  return { status: 'closed', verified: true, closureMethod: 'Closed by dispatcher' };
}

/**
 * @returns {'duplicate'|'unserved'|'volunteer'|'escalation'|'reassign'|'mismatch'|'backup'|'declined'|'default'}
 */
function incidentScenarioForIndex(i, total) {
  if (total >= 6 && i >= total - 6) return 'duplicate';
  const profile = statusProfileForIndex(i);
  if (profile.status === 'pending') return 'unserved';
  if (i % 12 === 1) return 'volunteer';
  if (i % 17 === 2) return 'escalation';
  if (i % 47 === 3) return 'reassign';
  if (i % 53 === 4) return 'mismatch';
  if (i % 59 === 5) return 'backup';
  if (i % 61 === 6) return 'declined';
  return 'default';
}

function seedCreatedAt(i, total, spanDays, nowMs = Date.now()) {
  const spanMs = spanDays * 86400000;
  const t = total <= 1 ? nowMs : nowMs - spanMs + (i / (total - 1)) * spanMs;
  const d = new Date(t);
  if (i % 5 === 0) {
    d.setUTCHours(9 + (i % 3), (i * 7) % 60, 0, 0);
  }
  return d;
}

/**
 * @param {number} createdMs
 * @param {{ fastSla?: boolean }} opts
 */
function buildDispatchTimeline(createdMs, opts = {}) {
  const fast = opts.fastSla !== false && (opts.index == null || opts.index % 10 !== 3);
  const dispatchDelaySec = fast ? 120 + (opts.index || 0) % 300 : 600 + (opts.index || 0) % 900;
  const arrivalDelaySec = fast
    ? dispatchDelaySec + 300 + (opts.index || 0) % 180
    : dispatchDelaySec + 900 + (opts.index || 0) % 600;
  const resolveDelaySec = arrivalDelaySec + 1200 + (opts.index || 0) % 2400;
  const closedExtraSec = 600;
  return {
    dispatchMs: createdMs + dispatchDelaySec * 1000,
    arrivalMs: createdMs + arrivalDelaySec * 1000,
    resolvedMs: createdMs + resolveDelaySec * 1000,
    closedMs: createdMs + resolveDelaySec * 1000 + closedExtraSec * 1000,
    dispatchDelaySec,
    arrivalDelaySec,
    withinDispatchTarget: dispatchDelaySec <= DISPATCH_TARGET_SEC,
    withinArrivalTarget: arrivalDelaySec <= ARRIVAL_TARGET_SEC,
  };
}

function channelMixRatios() {
  let sos = 0;
  let voice = 0;
  let text = 0;
  for (let i = 0; i < 100; i += 1) {
    const k = channelKindForIndex(i);
    if (k === 'sos') sos += 1;
    else if (k === 'voice') voice += 1;
    else text += 1;
  }
  return { sos: sos / 100, voice: voice / 100, text: text / 100 };
}

module.exports = {
  DEFAULT_INCIDENT_COUNT,
  DEFAULT_SEED_SPAN_DAYS,
  DISPATCH_TARGET_SEC,
  ARRIVAL_TARGET_SEC,
  parseSeedCli,
  departmentCodeForType,
  teamNameForDepartmentAndType,
  channelKindForIndex,
  statusProfileForIndex,
  incidentScenarioForIndex,
  seedCreatedAt,
  buildDispatchTimeline,
  channelMixRatios,
};
