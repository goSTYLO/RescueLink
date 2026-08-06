const { recordRequest, normalizePath } = require('../observability/latencyMetrics');

const VERBOSE_TIMING_LOGS = ['1', 'true', 'yes'].includes(String(process.env.TIMING_LOGS || '').trim().toLowerCase());

module.exports = function requestTimingMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const latencyMs = Number(elapsedNs) / 1_000_000;
    const normalizedPath = normalizePath(req.originalUrl || req.url || '/unknown');
    const role = req.user?.role || 'anonymous';

    recordRequest({
      method: req.method,
      path: normalizedPath,
      statusCode: res.statusCode,
      latencyMs,
      requestId: req.requestId,
      role,
    });

    if (VERBOSE_TIMING_LOGS && normalizedPath.startsWith('/api/')) {
      console.log(
        `[backend][timing] request_id=${req.requestId} method=${req.method} path=${normalizedPath} status=${res.statusCode} latency_ms=${Math.round(latencyMs)} role=${role}`
      );
    }
  });

  next();
};
