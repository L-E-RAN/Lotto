// בונה seedData.json מנתונים אמיתיים, ממיזוג מספר מקורות:
//  1) paisAPI — היסטוריה מלאה 2009→2024
//  2) Wayback Machine snapshots של lotteryextreme — לגישור הפער 2024→2026
//  3) lotteryextreme חי — ההגרלות העדכניות ביותר
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLotteryExtreme, deDot } from './sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAIS_API = 'https://paisapi.azurewebsites.net/lotto';
const LE_URL = 'https://www.lotteryextreme.com/israel/lotto-results';
const UA = { 'User-Agent': 'Mozilla/5.0' };

async function fromPaisApi(all) {
  try {
    const recent = (await axios.get(`${PAIS_API}/recent`, { timeout: 30000 })).data;
    const maxId = recent._id;
    for (let from = 1; from <= maxId; from += 250) {
      const to = Math.min(from + 249, maxId);
      const { data } = await axios.get(`${PAIS_API}/byID/${from}/${to}`, { timeout: 60000, validateStatus: () => true });
      for (const r of (Array.isArray(data) ? data : [data])) {
        if (r && Array.isArray(r.winNumbers) && r.winNumbers.length === 6 &&
            r.winNumbers.every((n) => n >= 1 && n <= 37) && r.strongNumber >= 1 && r.strongNumber <= 7) {
          all.set(r._id, { draw_number: r._id, date: (r.date || '').slice(0, 10), numbers: r.winNumbers, strong: r.strongNumber, source: 'paisAPI' });
        }
      }
    }
    console.log('  paisAPI: סה"כ', all.size);
  } catch (e) { console.warn('  paisAPI נכשל:', e.message); }
}

async function fromWayback(all) {
  try {
    const cdx = `http://web.archive.org/cdx/search/cdx?url=lotteryextreme.com/israel/lotto-results&from=20241001&to=20261231&output=json&collapse=digest`;
    const r = await axios.get(cdx, { timeout: 40000, validateStatus: () => true });
    const stamps = (Array.isArray(r.data) ? r.data.slice(1) : []).map((x) => x[1]);
    let before = all.size;
    for (const ts of stamps) {
      try {
        const snap = await axios.get(`http://web.archive.org/web/${ts}id_/${LE_URL}`, { timeout: 30000, headers: UA, responseType: 'text', validateStatus: () => true });
        for (const d of parseLotteryExtreme(snap.data)) if (!all.has(d.draw_number)) all.set(d.draw_number, { ...d, date: deDot(d.date), source: 'wayback' });
      } catch {}
    }
    console.log(`  Wayback (${stamps.length} snapshots): +${all.size - before}`);
  } catch (e) { console.warn('  Wayback נכשל:', e.message); }
}

async function fromLive(all) {
  try {
    const r = await axios.get(LE_URL, { timeout: 20000, headers: UA, responseType: 'text' });
    let before = all.size;
    for (const d of parseLotteryExtreme(r.data)) if (!all.has(d.draw_number)) all.set(d.draw_number, { ...d, date: deDot(d.date), source: 'lotteryextreme' });
    console.log(`  lotteryextreme חי: +${all.size - before}`);
  } catch (e) { console.warn('  lotteryextreme נכשל:', e.message); }
}

async function run() {
  const all = new Map();
  console.log('מושך נתונים אמיתיים...');
  await fromPaisApi(all);
  await fromWayback(all);
  await fromLive(all);

  const sorted = [...all.values()].sort((a, b) => a.draw_number - b.draw_number);
  if (sorted.length < 100) { console.error('מעט מדי נתונים, מבטל.'); process.exit(1); }

  // דיווח על חורים (הגרלות חסרות ברצף)
  const lo = sorted[0].draw_number, hi = sorted[sorted.length - 1].draw_number;
  const present = new Set(sorted.map((d) => d.draw_number));
  let holes = 0; for (let i = lo; i <= hi; i++) if (!present.has(i)) holes++;

  const out = sorted.map((d, i) => ({
    id: i + 1, draw_number: d.draw_number, draw_date: d.date,
    n1: [...d.numbers].sort((a, b) => a - b)[0], n2: [...d.numbers].sort((a, b) => a - b)[1],
    n3: [...d.numbers].sort((a, b) => a - b)[2], n4: [...d.numbers].sort((a, b) => a - b)[3],
    n5: [...d.numbers].sort((a, b) => a - b)[4], n6: [...d.numbers].sort((a, b) => a - b)[5],
    strong_number: d.strong, source: 'pais (' + d.source + ')', source_url: null,
    fetched_at: new Date().toISOString(), created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }));
  fs.writeFileSync(path.join(__dirname, 'seedData.json'), JSON.stringify(out));
  console.log(`\n✅ ${out.length} הגרלות אמיתיות. טווח ${lo}–${hi} (${out[0].draw_date}→${out[out.length-1].draw_date}). חורים ברצף: ${holes}.`);
}
run().catch((e) => { console.error('שגיאה:', e.message); process.exit(1); });
