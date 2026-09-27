const MANILA_TZ = 'Asia/Manila';

const SLUG_BY_CHART_ID = {
  headline: 'headline',
  response_matrix: 'response-matrix',
  volume: 'incident-volume',
  peak: 'peak-demand',
  types: 'incident-types',
  barangays: 'barangays',
  barangays_map: 'geographic-demand',
  barangays_top: 'top-barangays',
  type_barangay: 'type-barangay',
  channels: 'reporting-channels',
  exceptions: 'dispatch-exceptions',
  funnel: 'escalation-funnel',
  utilization: 'resource-utilization',
  outcomes: 'resolution-outcomes',
  department: 'by-department',
  incidents: 'incidents',
};

export function slugFromChartId(chartId) {
  if (!chartId) return 'full-report';
  if (SLUG_BY_CHART_ID[chartId]) return SLUG_BY_CHART_ID[chartId];
  return String(chartId).replace(/_/g, '-').replace(/[^\w-]/g, '');
}

export function formatInsightsExportStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}`;
}

export function buildInsightsExportFilename(slug, ext, date = new Date()) {
  return `insights-${slug}-${formatInsightsExportStamp(date)}.${ext}`;
}

function prepareCaptureClone(clonedDoc) {
  clonedDoc.querySelectorAll('.print\\:hidden, .metric-help, .metric-help-dialog').forEach((el) => {
    el.style.setProperty('display', 'none', 'important');
  });
  clonedDoc.querySelectorAll('.insights-print-table').forEach((el) => {
    el.style.setProperty('display', 'table', 'important');
  });
  clonedDoc.querySelectorAll('.insights-scroll-panel').forEach((el) => {
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';
    el.style.height = 'auto';
  });
  const cover = clonedDoc.getElementById('insights-export-cover');
  if (cover) {
    cover.classList.remove('hidden');
    cover.style.display = 'block';
  }
}

async function captureElement(html2canvas, element) {
  return html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (clonedDoc) => {
      prepareCaptureClone(clonedDoc);
    },
  });
}

function appendCanvasToPdf(pdf, canvas, marginMm, startNewPage) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const usableW = pageW - marginMm * 2;
  const usableH = pageH - marginMm * 2;
  const scale = usableW / canvas.width;
  const fullHeightMm = canvas.height * scale;

  if (fullHeightMm <= usableH) {
    if (startNewPage) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', marginMm, marginMm, usableW, fullHeightMm);
    return;
  }

  const sliceHeightPx = Math.floor(usableH / scale);
  let y = 0;
  let sliceIndex = 0;
  while (y < canvas.height) {
    if (sliceIndex > 0 || startNewPage) pdf.addPage();
    else if (startNewPage === false && sliceIndex === 0) {
      /* first slice on current page */
    }
    const h = Math.min(sliceHeightPx, canvas.height - y);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext('2d');
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    const sliceHmm = h * scale;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', marginMm, marginMm, usableW, sliceHmm);
    y += h;
    sliceIndex += 1;
  }
}

/**
 * Download Insights as PDF (html2canvas + jsPDF). ponytail: Leaflet OSM tiles may be blank (CORS); table under map is source of truth.
 */
export async function downloadInsightsPdf({ chartId } = {}) {
  const root = document.querySelector('.insights-root');
  if (!root) throw new Error('Insights page not ready');

  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(chartId) : chartId;
  const nodes = chartId
    ? [root.querySelector(`[data-insights-chart="${escaped}"]`)].filter(Boolean)
    : [...root.querySelectorAll('[data-insights-chart]')];

  if (!nodes.length) throw new Error('Nothing to export');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 10;
  let hasPdfContent = false;

  if (!chartId) {
    const cover = root.querySelector('#insights-export-cover');
    if (cover) {
      const coverCanvas = await captureElement(html2canvas, cover);
      appendCanvasToPdf(pdf, coverCanvas, margin, false);
      hasPdfContent = true;
    }
  }

  for (const node of nodes) {
    const canvas = await captureElement(html2canvas, node);
    appendCanvasToPdf(pdf, canvas, margin, hasPdfContent);
    hasPdfContent = true;
  }

  const slug = chartId ? slugFromChartId(chartId) : 'full-report';
  pdf.save(buildInsightsExportFilename(slug, 'pdf'));
}
