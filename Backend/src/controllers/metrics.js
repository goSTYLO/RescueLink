const latencyMetrics = require('../observability/latencyMetrics');

const metricsController = {
  getSummary(req, res) {
    const windowMs = Number(req.query.windowMs);
    const summary = latencyMetrics.getSummary({ windowMs });
    return res.json(summary);
  },

  reset(req, res) {
    latencyMetrics.reset();
    return res.status(202).json({ message: 'Latency metrics buffer reset' });
  },
};

module.exports = metricsController;
