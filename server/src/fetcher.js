import axios from 'axios';

// מקור רשמי: מפעל הפיס מפרסם קובץ CSV עם כל תוצאות הלוטו.
const PAIS_CSV_URL = 'https://www.pais.co.il/lotto/lottoResultsDownload.aspx';
const PAIS_PAGE = 'https://www.pais.co.il/lotto/lotto_results.aspx';

// מנסה למשוך תוצאות אמיתיות. מחזיר מערך הגרלות מנורמל, או [] אם נכשל.
export async function fetchLatestDraws() {
  try {
    const { data } = await axios.get(PAIS_CSV_URL, {
      timeout: 15000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 LottoStatAI' },
    });
    // הקובץ בקידוד windows-1255 (עברית). מפענחים ל-latin/utf בצורה סלחנית.
    const text = decodeHebrew(data);
    const rows = parsePaisCsv(text);
    if (rows.length) return rows;
  } catch (e) {
    console.warn('[fetcher] משיכת CSV נכשלה:', e.message);
  }
  return [];
}

function decodeHebrew(buf) {
  try {
    return new TextDecoder('windows-1255').decode(buf);
  } catch {
    return Buffer.from(buf).toString('utf8');
  }
}

// מנתח CSV של מפעל הפיס. עמודות: מס' הגרלה, תאריך, 6 מספרים, מספר חזק (+ עמודות נוספות)
function parsePaisCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out = [];
  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim());
    // מדלגים על כותרות
    const drawNumber = parseInt(cols[0], 10);
    if (!Number.isInteger(drawNumber)) continue;
    const date = normalizeDate(cols[1]);
    const nums = cols.slice(2, 8).map((c) => parseInt(c, 10));
    const strong = parseInt(cols[8], 10);
    if (nums.length !== 6 || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 37)) continue;
    if (!Number.isInteger(strong) || strong < 1 || strong > 7) continue;
    out.push({
      draw_number: drawNumber,
      draw_date: date,
      numbers: nums,
      strong_number: strong,
      source: 'pais.co.il',
      source_url: PAIS_PAGE,
    });
  }
  return out;
}

function normalizeDate(s) {
  if (!s) return new Date().toISOString().slice(0, 10);
  // תומך ב-DD/MM/YYYY
  const m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}
