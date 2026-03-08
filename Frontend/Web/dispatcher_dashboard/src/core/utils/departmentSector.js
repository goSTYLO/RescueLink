/**
 * Normalize department/sector code for matching teams (e.g. drrmo, pnp).
 */
export function normalizeSectorCode(rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  if (['drrmo', 'cdrmmo', 'cdrrmo'].includes(value)) return 'drrmo';
  if (['pnp', 'police'].includes(value)) return 'pnp';
  return value;
}

/**
 * Infer sector code from a department object (code, type, or name).
 */
export function inferDepartmentSectorCode(dept) {
  const directCode = normalizeSectorCode(dept?.code);
  if (directCode === 'drrmo' || directCode === 'pnp') return directCode;

  const type = String(dept?.type || '').trim().toLowerCase();
  if (type === 'police') return 'pnp';

  const name = String(dept?.name || '').trim().toLowerCase();
  if (/(police|pnp|crime)/i.test(name)) return 'pnp';
  return 'drrmo';
}
