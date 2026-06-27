// משיכת היסטוריית לוטו אמיתית מ-paisAPI וכתיבתה ל-seedData.json
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://paisapi.azurewebsites.net/lotto';

function mapRec(r, i) {
  const nums = [...r.winNumbers].sort((a, b) => a - b);
  return {
    id: i + 1,
    draw_number: r._id,
    draw_date: (r.date || '').slice(0, 10),
    n1: nums[0], n2: nums[1], n3: nums[2], n4: nums[3], n5: nums[4], n6: nums[5],
    strong_number: r.strongNumber,
    source: 'pais (paisAPI)',
    source_url: r.url || null,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
}

async function run() {
  // מצא את ההגרלה האחרונה
  const recent = (await axios.get(`${BASE}/recent`, { timeout: 30000 })).data;
  const maxId = recent._id;
  console.log('הגרלה אחרונה ב-API:', maxId, recent.date?.slice(0, 10));

  const all = new Map();
  const CHUNK = 250;
  for (let from = 1; from <= maxId; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, maxId);
    try {
      const { data } = await axios.get(`${BASE}/byID/${from}/${to}`, { timeout: 60000, validateStatus: () => true });
      const arr = Array.isArray(data) ? data : [data];
      let ok = 0;
      for (const r of arr) {
        if (r && Array.isArray(r.winNumbers) && r.winNumbers.length === 6 &&
            r.winNumbers.every((n) => n >= 1 && n <= 37) && r.strongNumber >= 1 && r.strongNumber <= 7) {
          all.set(r._id, r); ok++;
        }
      }
      console.log(`  ${from}-${to}: ${ok} תקינות (סה"כ ${all.size})`);
    } catch (e) {
      console.warn(`  ${from}-${to} נכשל:`, e.message);
    }
  }

  const sorted = [...all.values()].sort((a, b) => a._id - b._id).map(mapRec);
  if (sorted.length < 100) { console.error('מעט מדי נתונים, מבטל.'); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, 'seedData.json'), JSON.stringify(sorted));
  console.log(`\n✅ נכתב seedData.json עם ${sorted.length} הגרלות אמיתיות (${sorted[0].draw_date} → ${sorted[sorted.length - 1].draw_date}).`);
}

run().catch((e) => { console.error('שגיאה:', e.message); process.exit(1); });
