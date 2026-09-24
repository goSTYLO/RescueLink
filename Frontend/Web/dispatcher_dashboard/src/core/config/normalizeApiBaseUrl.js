/** Strip trailing slashes and accidental markdown link paste from env (Vercel). */
export function normalizeApiBaseUrl(raw, fallback = 'http://localhost:3000') {
  let s = String(raw ?? '').trim();
  if (!s) return fallback;
  const afterBracket = s.match(/\]\((https?:\/\/[^)\s]+)/i);
  if (afterBracket) s = afterBracket[1];
  else {
    const origin = s.match(/https?:\/\/[^\]\s)]+/i);
    if (origin) s = origin[0];
  }
  s = s.replace(/\/+$/, '');
  return s || fallback;
}
