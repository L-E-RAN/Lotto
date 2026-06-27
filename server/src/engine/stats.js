import { MAX_NUMBER, STRONG_MAX, decadeOf, isEven, isLow } from './config.js';

export function drawNumbers(d) {
  return [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6];
}

// מקבל מערך הגרלות (ממוין מהישן לחדש) ומחזיר סטטיסטיקות לכל מספר רגיל
export function numberStats(draws) {
  const total = draws.length;
  const counts = new Array(MAX_NUMBER + 1).fill(0);
  const lastSeenIndex = new Array(MAX_NUMBER + 1).fill(-1);
  const lastSeenDate = new Array(MAX_NUMBER + 1).fill(null);
  const windows = { 10: {}, 25: {}, 50: {}, 100: {} };
  for (const w of [10, 25, 50, 100]) windows[w] = new Array(MAX_NUMBER + 1).fill(0);

  draws.forEach((d, i) => {
    for (const n of drawNumbers(d)) {
      counts[n]++;
      lastSeenIndex[n] = i;
      lastSeenDate[n] = d.draw_date;
    }
  });

  for (const w of [10, 25, 50, 100]) {
    const slice = draws.slice(Math.max(0, total - w));
    for (const d of slice) for (const n of drawNumbers(d)) windows[w][n]++;
  }

  const result = [];
  for (let n = 1; n <= MAX_NUMBER; n++) {
    const drawsSince = lastSeenIndex[n] >= 0 ? total - 1 - lastSeenIndex[n] : total;
    const pct = total ? (counts[n] / total) * 100 : 0;
    // מגמה: השוואת קצב הופעה ב-25 אחרונות מול הממוצע הכללי
    const recentRate = windows[25][n] / 25;
    const overallRate = counts[n] / total || 0;
    let trend = 'יציב';
    if (recentRate > overallRate * 1.25) trend = 'עולה';
    else if (recentRate < overallRate * 0.75) trend = 'יורד';
    // ציון סטטיסטי: שילוב תדירות, מגמה ו"איחור"
    const freqScore = pct;
    const overdueScore = Math.min(drawsSince, 60) / 60 * 30;
    const trendScore = trend === 'עולה' ? 10 : trend === 'יורד' ? -5 : 0;
    const score = Math.round((freqScore + overdueScore + trendScore) * 10) / 10;

    result.push({
      number: n,
      count: counts[n],
      pct: Math.round(pct * 100) / 100,
      lastDate: lastSeenDate[n],
      drawsSince,
      last10: windows[10][n],
      last25: windows[25][n],
      last50: windows[50][n],
      last100: windows[100][n],
      trend,
      score,
    });
  }
  return result;
}

export function strongStats(draws) {
  const total = draws.length;
  const counts = new Array(STRONG_MAX + 1).fill(0);
  const lastSeenIndex = new Array(STRONG_MAX + 1).fill(-1);
  const lastSeenDate = new Array(STRONG_MAX + 1).fill(null);

  draws.forEach((d, i) => {
    counts[d.strong_number]++;
    lastSeenIndex[d.strong_number] = i;
    lastSeenDate[d.strong_number] = d.draw_date;
  });

  const list = [];
  for (let n = 1; n <= STRONG_MAX; n++) {
    const drawsSince = lastSeenIndex[n] >= 0 ? total - 1 - lastSeenIndex[n] : total;
    list.push({
      number: n,
      count: counts[n],
      pct: total ? Math.round((counts[n] / total) * 10000) / 100 : 0,
      lastDate: lastSeenDate[n],
      drawsSince,
    });
  }
  const sorted = [...list].sort((a, b) => b.count - a.count);
  return {
    list,
    hot: sorted.slice(0, 2).map((x) => x.number),
    cold: sorted.slice(-2).map((x) => x.number),
  };
}

export function pairStats(draws, limit = 30) {
  const total = draws.length;
  const counts = new Map();
  const lastSeen = new Map();
  draws.forEach((d, i) => {
    const nums = drawNumbers(d).sort((a, b) => a - b);
    for (let a = 0; a < nums.length; a++)
      for (let b = a + 1; b < nums.length; b++) {
        const key = `${nums[a]}-${nums[b]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
        lastSeen.set(key, i);
      }
  });
  const all = [...counts.entries()].map(([key, count]) => {
    const [a, b] = key.split('-').map(Number);
    return { a, b, count, drawsSince: total - 1 - lastSeen.get(key) };
  });
  return {
    common: [...all].sort((x, y) => y.count - x.count).slice(0, limit),
    overdue: [...all].sort((x, y) => y.drawsSince - x.drawsSince).slice(0, limit),
    all,
  };
}

export function tripleStats(draws, limit = 20) {
  const counts = new Map();
  draws.forEach((d) => {
    const nums = drawNumbers(d).sort((a, b) => a - b);
    for (let a = 0; a < nums.length; a++)
      for (let b = a + 1; b < nums.length; b++)
        for (let c = b + 1; c < nums.length; c++) {
          const key = `${nums[a]}-${nums[b]}-${nums[c]}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
  });
  return [...counts.entries()]
    .map(([key, count]) => {
      const [a, b, c] = key.split('-').map(Number);
      return { a, b, c, count };
    })
    .sort((x, y) => y.count - x.count)
    .slice(0, limit);
}

// ניתוח תבנית של צירוף בודד
export function patternOf(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const even = sorted.filter(isEven).length;
  const low = sorted.filter(isLow).length;
  const sum = sorted.reduce((s, n) => s + n, 0);
  const decadeCount = {};
  for (const n of sorted) decadeCount[decadeOf(n)] = (decadeCount[decadeOf(n)] || 0) + 1;
  const maxSameDecade = Math.max(...Object.values(decadeCount));
  let sequences = 0;
  let maxRun = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) { run++; if (run === 2) sequences++; }
    else run = 1;
    maxRun = Math.max(maxRun, run);
  }
  const spread = sorted[sorted.length - 1] - sorted[0];
  // נראה מבוסס תאריך לידה: כל המספרים <= 31, ולפחות 2 <= 12
  const birthdayLike = sorted.every((n) => n <= 31) && sorted.filter((n) => n <= 12).length >= 2;
  return {
    even, odd: sorted.length - even,
    low, high: sorted.length - low,
    sum, maxSameDecade, sequences, maxRun, spread, birthdayLike,
  };
}

export function sumDistribution(draws) {
  const sums = draws.map((d) => drawNumbers(d).reduce((s, n) => s + n, 0));
  sums.sort((a, b) => a - b);
  const mean = sums.reduce((s, x) => s + x, 0) / (sums.length || 1);
  const p = (q) => sums[Math.floor(q * (sums.length - 1))] || 0;
  return { mean: Math.round(mean), min: sums[0], max: sums[sums.length - 1], p10: p(0.1), p90: p(0.9) };
}
