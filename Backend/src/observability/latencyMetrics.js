const MAX_SAMPLES_PER_ENDPOINT = 500;
const DEFAULT_WINDOW_MS = 60_000;

const endpointSamples = new Map();

function normalizePath(pathname) {
  if (!pathname || typeof pathname !== 'string') {
    return '/unknown';
  }

  const withoutQuery = pathname.split('?')[0] || pathname;
  return withoutQuery
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/(\d+)(?=\/|$)/g, '/:id')
    .replace(/\/(0x[0-9a-f]+)(?=\/|$)/gi, '/:id');
}

function keyFor({ method, path }) {
  return `${String(method || 'GET').toUpperCase()} ${normalizePath(path)}`;
}

function pushBoundedSample(samples, sample) {
  samples.push(sample);
  if (samples.length > MAX_SAMPLES_PER_ENDPOINT) {
    samples.splice(0, samples.length - MAX_SAMPLES_PER_ENDPOINT);
  }
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  if (p <= 0) return sortedValues[0];
  if (p >= 100) return sortedValues[sortedValues.length - 1];

  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  const safeIndex = Math.min(sortedValues.length - 1, Math.max(0, index));
  return sortedValues[safeIndex];
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function recordRequest({ method, path, statusCode, latencyMs, requestId, role }) {
  const key = keyFor({ method, path });
  const sample = {
    at: Date.now(),
    statusCode: Number(statusCode) || 0,
    latencyMs: Number(latencyMs) || 0,
    requestId: requestId || null,
    role: role || 'anonymous',
  };

  const current = endpointSamples.get(key) || [];
  pushBoundedSample(current, sample);
  endpointSamples.set(key, current);
}

function aggregateSamples(samples, windowMs) {
  const cutoff = Date.now() - windowMs;
  const inWindow = samples.filter((sample) => sample.at >= cutoff);
  if (inWindow.length === 0) {
    return null;
  }

  const latencies = inWindow.map((sample) => sample.latencyMs).sort((a, b) => a - b);
  const count = inWindow.length;
  const errors = inWindow.filter((sample) => sample.statusCode >= 500).length;
  const clientErrors = inWindow.filter((sample) => sample.statusCode >= 400 && sample.statusCode < 500).length;
  const sum = latencies.reduce((acc, value) => acc + value, 0);

  const byRole = {};
  for (const sample of inWindow) {
    const role = sample.role || 'anonymous';
    byRole[role] = (byRole[role] || 0) + 1;
  }

  return {
    count,
    errorCount: errors,
    clientErrorCount: clientErrors,
    errorRate: roundMs((errors / count) * 100),
    avgMs: roundMs(sum / count),
    minMs: roundMs(latencies[0]),
    p50Ms: roundMs(percentile(latencies, 50)),
    p95Ms: roundMs(percentile(latencies, 95)),
    p99Ms: roundMs(percentile(latencies, 99)),
    maxMs: roundMs(latencies[latencies.length - 1]),
    byRole,
  };
}

function getSummary({ windowMs = DEFAULT_WINDOW_MS } = {}) {
  const resolvedWindowMs = Math.max(1_000, Number(windowMs) || DEFAULT_WINDOW_MS);
  const endpoints = {};

  for (const [key, samples] of endpointSamples.entries()) {
    const aggregate = aggregateSamples(samples, resolvedWindowMs);
    if (aggregate) {
      endpoints[key] = aggregate;
    }
  }

  const topSlow = Object.entries(endpoints)
    .sort((a, b) => b[1].p95Ms - a[1].p95Ms)
    .slice(0, 10)
    .map(([endpoint, stats]) => ({ endpoint, p95Ms: stats.p95Ms, count: stats.count }));

  return {
    generatedAt: new Date().toISOString(),
    windowMs: resolvedWindowMs,
    endpointCount: Object.keys(endpoints).length,
    endpoints,
    topSlow,
  };
}

function reset() {
  endpointSamples.clear();
}

module.exports = {
  recordRequest,
  getSummary,
  reset,
  normalizePath,
};
