import axios from 'axios';
import { parseLotteryExtreme, deDot } from './sources.js';

// מקורות נתונים אמיתיים:
//  1) lotteryextreme — עדכני (מתעדכן בכל הגרלה) → "מהיום והלאה"
//  2) paisAPI — היסטוריה (גיבוי)
//  3) CSV רשמי של פייס (לרוב חסום לשרת)
const LE_URL = 'https://www.lotteryextreme.com/israel/lotto-results';
const PAIS_API = 'https://paisapi.azurewebsites.net/lotto';
const PAIS_CSV_URL = 'https://www.pais.co.il/lotto/lottoResultsDownload.aspx';
const PAIS_PAGE = 'https://www.pais.co.il/lotto/lotto_results.aspx';
const UA = { 'User-Agent': 'Mozilla/5.0 LottoStatAI' };

// מושך את ההגרלות העדכניות. העדכון מסנן כפילויות בעצמו.
export async function fetchLatestDraws() {
  // 1) lotteryextreme — המקור העדכני
  try {
    const { data } = await axios.get(LE_URL, { timeout: 20000, headers: UA, responseType: 'text' });
    const rows = parseLotteryExtreme(data).map((d) => ({
      draw_number: d.draw_number,
      draw_date: deDot(d.date),
      numbers: d.numbers,
      strong_number: d.strong,
      source: 'pais (lotteryextreme)',
      source_url: LE_URL,
    }));
    if (rows.length) return rows;
  } catch (e) {
    console.warn('[fetcher] lotteryextreme נכשל:', e.message);
  }

  // 2) paisAPI — גיבוי היסטורי
  try {
    const { data: recent } = await axios.get(`${PAIS_API}/recent`, { timeout: 20000 });
    const maxId = recent?._id;
    if (Number.isInteger(maxId)) {
      const { data } = await axios.get(`${PAIS_API}/byID/${Math.max(1, maxId - 30)}/${maxId}`, { timeout: 30000, validateStatus: () => true });
      const arr = (Array.isArray(data) ? data : [data])
        .filter((r) => r && Array.isArray(r.winNumbers) && r.winNumbers.length === 6 &&
          r.winNumbers.every((n) => n >= 1 && n <= 37) && r.strongNumber >= 1 && r.strongNumber <= 7)
        .map((r) => ({ draw_number: r._id, draw_date: (r.date || '').slice(0, 10), numbers: r.winNumbers, strong_number: r.strongNumber, source: 'pais (paisAPI)', source_url: r.url || PAIS_PAGE }));
      if (arr.length) return arr;
    }
  } catch (e) {
    console.warn('[fetcher] paisAPI נכשל:', e.message);
  }

  // 3) CSV רשמי
  try {
    const { data } = await axios.get(PAIS_CSV_URL, { timeout: 15000, responseType: 'arraybuffer', headers: UA });
    const text = (() => { try { return new TextDecoder('windows-1255').decode(data); } catch { return Buffer.from(data).toString('utf8'); } })();
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const cols = line.split(',').map((c) => c.trim());
      const dn = parseInt(cols[0], 10);
      if (!Number.isInteger(dn)) continue;
      const nums = cols.slice(2, 8).map((c) => parseInt(c, 10));
      const strong = parseInt(cols[8], 10);
      if (nums.length === 6 && nums.every((n) => n >= 1 && n <= 37) && strong >= 1 && strong <= 7) {
        rows.push({ draw_number: dn, draw_date: cols[1], numbers: nums, strong_number: strong, source: 'pais.co.il', source_url: PAIS_PAGE });
      }
    }
    if (rows.length) return rows;
  } catch (e) {
    console.warn('[fetcher] CSV רשמי נכשל:', e.message);
  }
  return [];
}
