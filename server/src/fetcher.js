import axios from 'axios';

// מקור נתונים אמיתי: paisAPI (REST לא-רשמי לתוצאות מפעל הפיס).
const PAIS_API = 'https://paisapi.azurewebsites.net/lotto';
// גיבוי: ה-CSV הרשמי של מפעל הפיס (לרוב חסום לבקשות שרת בגלל Akamai).
const PAIS_CSV_URL = 'https://www.pais.co.il/lotto/lottoResultsDownload.aspx';
const PAIS_PAGE = 'https://www.pais.co.il/lotto/lotto_results.aspx';

function mapApi(r) {
  if (!r || !Array.isArray(r.winNumbers) || r.winNumbers.length !== 6) return null;
  if (!r.winNumbers.every((n) => n >= 1 && n <= 37)) return null;
  if (!(r.strongNumber >= 1 && r.strongNumber <= 7)) return null;
  return {
    draw_number: r._id,
    draw_date: (r.date || '').slice(0, 10),
    numbers: r.winNumbers,
    strong_number: r.strongNumber,
    source: 'pais (paisAPI)',
    source_url: r.url || PAIS_PAGE,
  };
}

// מושך את ההגרלות העדכניות ביותר. מחזיר מערך מנורמל (העדכון מסנן כפילויות בעצמו).
export async function fetchLatestDraws() {
  // 1) ניסיון דרך ה-API החי
  try {
    const { data: recent } = await axios.get(`${PAIS_API}/recent`, { timeout: 20000 });
    const maxId = recent?._id;
    if (Number.isInteger(maxId)) {
      const from = Math.max(1, maxId - 30);
      const { data } = await axios.get(`${PAIS_API}/byID/${from}/${maxId}`, { timeout: 30000, validateStatus: () => true });
      const arr = Array.isArray(data) ? data : [data];
      const mapped = arr.map(mapApi).filter(Boolean);
      if (mapped.length) return mapped;
      const one = mapApi(recent);
      if (one) return [one];
    }
  } catch (e) {
    console.warn('[fetcher] paisAPI נכשל:', e.message);
  }

  // 2) גיבוי: CSV רשמי
  try {
    const { data } = await axios.get(PAIS_CSV_URL, {
      timeout: 15000, responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 LottoStatAI' },
    });
    const text = decodeHebrew(data);
    const rows = parsePaisCsv(text);
    if (rows.length) return rows;
  } catch (e) {
    console.warn('[fetcher] CSV רשמי נכשל:', e.message);
  }
  return [];
}

function decodeHebrew(buf) {
  try { return new TextDecoder('windows-1255').decode(buf); }
  catch { return Buffer.from(buf).toString('utf8'); }
}

function parsePaisCsv(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split(',').map((c) => c.trim());
    const drawNumber = parseInt(cols[0], 10);
    if (!Number.isInteger(drawNumber)) continue;
    const nums = cols.slice(2, 8).map((c) => parseInt(c, 10));
    const strong = parseInt(cols[8], 10);
    if (nums.length !== 6 || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 37)) continue;
    if (!Number.isInteger(strong) || strong < 1 || strong > 7) continue;
    out.push({ draw_number: drawNumber, draw_date: normalizeDate(cols[1]), numbers: nums, strong_number: strong, source: 'pais.co.il', source_url: PAIS_PAGE });
  }
  return out;
}

function normalizeDate(s) {
  if (!s) return new Date().toISOString().slice(0, 10);
  const m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  return s;
}
