import { choroplethFill } from '@/presentation/components/insights/insightsColors';



/** Intensity step 0–4 for a type × barangay cell. Higher count → stronger step. */

export function matrixIntensityStep(count, max) {

  const n = Number(count) || 0;

  const m = Number(max) || 0;

  if (n <= 0 || m <= 0) return 0;

  const t = n / m;

  if (t >= 0.75) return 4;

  if (t >= 0.5) return 3;

  if (t >= 0.25) return 2;

  return 1;

}



export function matrixCellBackground(count, max, isLight = true) {

  return choroplethFill(Number(count) || 0, Number(max) || 0, isLight);

}



function parseHex(hex) {

  const raw = String(hex || '').replace('#', '');

  if (raw.length !== 6) return null;

  const r = parseInt(raw.slice(0, 2), 16);

  const g = parseInt(raw.slice(2, 4), 16);

  const b = parseInt(raw.slice(4, 6), 16);

  if ([r, g, b].some((v) => Number.isNaN(v))) return null;

  return { r, g, b };

}



function relativeLuminance({ r, g, b }) {

  const srgb = [r, g, b].map((c) => {

    const v = c / 255;

    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];

}



/** Type-tinted square background; numerals stay neutral foreground. */

function typeTintBackground(count, max, typeHex, isLight) {

  const n = Number(count) || 0;

  const m = Number(max) || 0;

  if (n <= 0) return 'transparent';

  const rgb = parseHex(typeHex);

  if (!rgb) return matrixCellBackground(n, max, isLight);

  const t = Math.min(1, n / Math.max(m, 1));

  const alpha = 0.2 + t * 0.65;

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

}



function textOnBackground(backgroundColor, isLight, typeHex) {

  const rgb = parseHex(typeHex);

  if (!rgb) return isLight ? '#111827' : '#E5E7EB';

  const parts = String(backgroundColor).match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  const alpha = parts?.[4] != null ? parseFloat(parts[4]) : 0.5;
  const base = isLight ? 255 : 17;
  const blend = (c) => c * alpha + base * (1 - alpha);

  const blended = { r: blend(rgb.r), g: blend(rgb.g), b: blend(rgb.b) };

  const lum = relativeLuminance(blended);

  return lum > 0.45 ? '#111827' : '#E5E7EB';

}



/** Heat/type-tinted cell badge; count uses neutral text, not type color. */

export function matrixCellStyle(count, max, isLight, typeHex) {

  const n = Number(count) || 0;

  if (n <= 0) {

    return { backgroundColor: 'transparent' };

  }

  const backgroundColor = typeTintBackground(n, max, typeHex, isLight);

  return {

    backgroundColor,

    color: textOnBackground(backgroundColor, isLight, typeHex),

    fontWeight: 600,

  };

}



/** Pivot type_barangay rows into top barangay columns. */

export function buildTypeBarangayMatrix(rows, barangayLimit = 8) {

  const totals = new Map();

  for (const row of rows || []) {

    const name = row?.barangay || 'Unknown';

    totals.set(name, (totals.get(name) || 0) + (Number(row.count) || 0));

  }

  const barangays = [...totals.entries()]

    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

    .slice(0, barangayLimit)

    .map(([name]) => name);

  const allowed = new Set(barangays);

  const types = [];

  const lookup = new Map();

  let max = 0;

  for (const row of rows || []) {

    const name = row?.barangay || 'Unknown';

    if (!allowed.has(name)) continue;

    const type = row?.incident_type || 'unknown';

    if (!types.includes(type)) types.push(type);

    const count = Number(row.count) || 0;

    lookup.set(`${type}|${name}`, count);

    if (count > max) max = count;

  }

  return { barangays, types, lookup, max };

}

