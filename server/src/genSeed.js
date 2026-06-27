// סקריפט חד-פעמי: מייצר dataset קפוא של היסטוריית הגרלות ל-seedData.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function weightedDraw(weights, k, max) {
  const set = new Set();
  while (set.size < k) {
    const total = weights.slice(1, max + 1).reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    let pick = 1;
    for (let n = 1; n <= max; n++) { r -= weights[n]; if (r <= 0) { pick = n; break; } }
    set.add(pick);
  }
  return [...set].sort((a, b) => a - b);
}

function generate(count = 1500) {
  // אחיד מלא — כמו הגרלה הוגנת. ללא הטיה מלאכותית (ליושרה סטטיסטית).
  const weights = new Array(38).fill(1);
  const sw = new Array(8).fill(1);

  const draws = [];
  const start = new Date();
  start.setDate(start.getDate() - count * 3.5);
  let date = new Date(start);
  for (let i = 0; i < count; i++) {
    const nums = weightedDraw(weights, 6, 37);
    draws.push({
      id: i + 1,
      draw_number: 1000 + i,
      draw_date: date.toISOString().slice(0, 10),
      n1: nums[0], n2: nums[1], n3: nums[2], n4: nums[3], n5: nums[4], n6: nums[5],
      strong_number: weightedDraw(sw, 1, 7)[0],
      source: 'seed', source_url: null,
      fetched_at: new Date().toISOString(), created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    date = new Date(date); date.setDate(date.getDate() + (i % 2 === 0 ? 3 : 4));
  }
  return draws;
}

const out = generate(1500);
fs.writeFileSync(path.join(__dirname, 'seedData.json'), JSON.stringify(out));
console.log(`seedData.json נכתב עם ${out.length} הגרלות.`);
