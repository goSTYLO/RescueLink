/**
 * Report generation utilities for blockchain gas optimization tests.
 * Outputs JSON and Markdown reports to Blockchain/tests/reports/
 */
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, 'reports');

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function timestamp() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${date}_${time}`;
}

/**
 * Write JSON report
 * @param {object} data - Report data
 * @returns {string} Path to written file
 */
function writeJsonReport(data) {
  ensureReportsDir();
  const filename = `gas_report_${timestamp()}.json`;
  const filepath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  return filepath;
}

/**
 * Write Markdown report
 * @param {object} data - Report data (same structure as JSON)
 * @returns {string} Path to written file
 */
function writeMarkdownReport(data) {
  ensureReportsDir();
  const filename = `gas_report_${timestamp()}.md`;
  const filepath = path.join(REPORTS_DIR, filename);
  const md = buildMarkdown(data);
  fs.writeFileSync(filepath, md, 'utf8');
  return filepath;
}

function buildMarkdown(data) {
  const lines = [];
  lines.push('# RescueLink Blockchain Gas Report');
  lines.push('');
  lines.push(`**Generated:** ${data.timestamp || new Date().toISOString()}`);
  lines.push(`**Environment:** ${data.environment || 'ganache'}`);
  lines.push('');

  if (data.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total transactions | ${data.summary.total_transactions || 0} |`);
    lines.push(`| Total gas used | ${data.summary.total_gas_used || 0} |`);
    lines.push(`| Avg gas per tx | ${data.summary.avg_gas_per_tx || 0} |`);
    lines.push(`| Gas savings from dedup | ${data.summary.gas_savings_from_dedup || 0} |`);
    lines.push('');
  }

  if (data.optimization_comparison) {
    lines.push('## Contract Optimization Comparison');
    lines.push('');
    lines.push('| Approach | Avg Gas |');
    lines.push('|----------|----------|');
    const oc = data.optimization_comparison;
    if (oc.events_approach) {
      lines.push(`| Events (current) | ${oc.events_approach.avg_gas || oc.events_approach.gas_used || 0} |`);
    }
    if (oc.storage_approach) {
      lines.push(`| Storage (alternative) | ${oc.storage_approach.avg_gas || oc.storage_approach.gas_used || 0} |`);
    }
    if (oc.savings_percent != null) {
      lines.push(`| **Savings (events vs storage)** | **${oc.savings_percent.toFixed(1)}%** |`);
    }
    lines.push('');
    lines.push('### Recommendation');
    lines.push('The events-based approach minimizes gas costs by storing only an audit trail on-chain.');
    lines.push('Use storage-based approach only when on-chain data queries are required.');
    lines.push('');
  }

  if (data.transactions && data.transactions.length > 0) {
    lines.push('## Transaction Details');
    lines.push('');
    lines.push('| # | Report ID | Gas Used | TX Hash | Already Recorded |');
    lines.push('|---|-----------|----------|---------|------------------|');
    data.transactions.slice(0, 20).forEach((tx, i) => {
      const hash = (tx.tx_hash || '').slice(0, 18) + '...';
      lines.push(`| ${i + 1} | ${tx.report_id || '-'} | ${tx.gas_used || 0} | ${hash} | ${tx.already_recorded ? 'Yes' : 'No'} |`);
    });
    if (data.transactions.length > 20) {
      lines.push(`| ... | ... | ... | ... | ${data.transactions.length - 20} more |`);
    }
    lines.push('');
  }

  if (data.prerequisites) {
    lines.push('## Prerequisites Check');
    lines.push('');
    lines.push('| Service | Status |');
    lines.push('|---------|--------|');
    Object.entries(data.prerequisites).forEach(([name, status]) => {
      lines.push(`| ${name} | ${status ? 'OK' : 'Not available'} |`);
    });
    lines.push('');
  }

  if (data.notes && data.notes.length > 0) {
    lines.push('## Notes');
    lines.push('');
    data.notes.forEach((n) => lines.push(`- ${n}`));
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  writeJsonReport,
  writeMarkdownReport,
  ensureReportsDir,
  REPORTS_DIR,
};
