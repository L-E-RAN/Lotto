import { MAX_NUMBER, STRONG_MAX, decadeOf, isEven, isLow } from './config.js';
import { wilsonInterval } from './statTests.js';

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
    const ci = wilsonInterval(counts[n], total); // רווח סמך 95% לפרופורציה

    result.push({
      number: n,
      count: counts[n],
      pct: Math.round(pct * 100) / 100,
      ciLow: ci.low,
      ciHigh: ci.high,
      ciMargin: ci.margin,
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

// דפוס חזרתיות לכל מספר: מרווח ממוצע בין הופעות + מדד סדירות
export function intervalStats(draws) {
  const total = draws.length;
  const positions = {}; // number -> [indices]
  for (let n = 1; n <= MAX_NUMBER; n++) positions[n] = [];
  draws.forEach((d, i) => { for (const n of drawNumbers(d)) positions[n].push(i); });

  const out = [];
  for (let n = 1; n <= MAX_NUMBER; n++) {
    const pos = positions[n];
    const gaps = [];
    for (let k = 1; k < pos.length; k++) gaps.push(pos[k] - pos[k - 1]);
    const count = pos.length;
    const avgGap = count > 1 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : total;
    const meanG = avgGap;
    const variance = gaps.length ? gaps.reduce((s, g) => s + (g - meanG) ** 2, 0) / gaps.length : 0;
    const std = Math.sqrt(variance);
    const cv = meanG ? std / meanG : 0;                       // מקדם שונות
    const sortedG = [...gaps].sort((a, b) => a - b);
    const median = sortedG.length ? sortedG[Math.floor(sortedG.length / 2)] : avgGap;
    const currentGap = pos.length ? total - 1 - pos[pos.length - 1] : total;
    // תווית סדירות: ככל ש-CV נמוך, המרווח קבוע יותר
    const regularity = cv < 0.55 ? 'סדיר' : cv < 0.85 ? 'בינוני' : 'אקראי';

    out.push({
      number: n,
      count,
      avgGap: Math.round(avgGap * 100) / 100,
      medianGap: median,
      stdGap: Math.round(std * 100) / 100,
      cv: Math.round(cv * 100) / 100,
      minGap: sortedG[0] ?? null,
      maxGap: sortedG[sortedG.length - 1] ?? null,
      currentGap,
      regularity,
      due: currentGap >= avgGap, // "מאחר" — עבר יותר מהמרווח הממוצע
      text: `מספר ${n} יוצא בממוצע פעם ב-${(Math.round(avgGap * 10) / 10)} הגרלות`,
    });
  }
  return out;
}

// פרופיל תבניות מלא למספר יחיד
export function numberPattern(draws, n) {
  const total = draws.length;
  const has = (d) => drawNumbers(d).includes(n);
  const pos = [];
  draws.forEach((d, i) => { if (has(d)) pos.push(i); });
  const count = pos.length;

  // מרווחים + היסטוגרמה
  const gaps = [];
  for (let k = 1; k < pos.length; k++) gaps.push(pos[k] - pos[k - 1]);
  const gapHist = {};
  for (const g of gaps) gapHist[g] = (gapHist[g] || 0) + 1;
  const histogram = Object.entries(gapHist).map(([g, c]) => ({ gap: +g, count: c })).sort((a, b) => a.gap - b.gap);
  const avgGap = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : total;
  const sortedG = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedG.length ? sortedG[Math.floor(sortedG.length / 2)] : 0;
  const modeGap = histogram.length ? histogram.reduce((a, b) => (b.count > a.count ? b : a)).gap : 0;
  const currentGap = pos.length ? total - 1 - pos[pos.length - 1] : total;

  // רצפים (הופעה בהגרלות עוקבות) + בצורת הכי ארוכה
  let maxStreak = 0, cur = 0, backToBack = 0;
  draws.forEach((d) => { if (has(d)) { cur++; if (cur >= 2) backToBack++; maxStreak = Math.max(maxStreak, cur); } else cur = 0; });
  const maxDrought = gaps.length ? Math.max(...gaps) : total;

  // נטייה לפי יום בשבוע
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayTotal = new Array(7).fill(0), dayHit = new Array(7).fill(0);
  for (const d of draws) {
    const wd = new Date(d.draw_date + 'T00:00:00').getDay();
    if (Number.isNaN(wd)) continue;
    dayTotal[wd]++; if (has(d)) dayHit[wd]++;
  }
  const baseRate = count / total || 0;
  const weekday = dayNames.map((name, i) => ({
    day: name, draws: dayTotal[i], hits: dayHit[i],
    rate: dayTotal[i] ? Math.round((dayHit[i] / dayTotal[i]) * 1000) / 10 : 0,
    vsBase: dayTotal[i] ? Math.round(((dayHit[i] / dayTotal[i]) / baseRate) * 100) / 100 : 0,
  })).filter((x) => x.draws > 0);

  // שותפים (קו-הופעה) עם lift
  const freq = new Array(MAX_NUMBER + 1).fill(0);
  const co = new Array(MAX_NUMBER + 1).fill(0);
  for (const d of draws) {
    const nums = drawNumbers(d);
    for (const x of nums) freq[x]++;
    if (nums.includes(n)) for (const x of nums) if (x !== n) co[x]++;
  }
  const companions = [];
  for (let x = 1; x <= MAX_NUMBER; x++) {
    if (x === n || !co[x]) continue;
    const expected = total ? (freq[n] / total) * (freq[x] / total) * total : 0;
    companions.push({ number: x, count: co[x], lift: expected ? Math.round((co[x] / expected) * 100) / 100 : 0 });
  }
  companions.sort((a, b) => b.count - a.count);

  // "יד חמה": הסתברות להופיע בהגרלה הבאה בהינתן שהופיע כעת, מול קצב הבסיס
  let follow = 0, opportunities = 0;
  for (let i = 0; i < draws.length - 1; i++) if (has(draws[i])) { opportunities++; if (has(draws[i + 1])) follow++; }
  const followRate = opportunities ? follow / opportunities : 0;

  // מגמה אחרונה
  const rate = (w) => { const s = draws.slice(-w); return s.length ? Math.round((s.filter(has).length / s.length) * 1000) / 10 : 0; };

  return {
    number: n,
    count,
    pct: total ? Math.round((count / total) * 1000) / 10 : 0,
    avgGap: Math.round(avgGap * 100) / 100,
    medianGap, modeGap, currentGap,
    maxStreak, backToBack, maxDrought,
    histogram,
    weekday,
    companions: companions.slice(0, 8),
    hotHand: {
      followRate: Math.round(followRate * 1000) / 10,
      baseRate: Math.round(baseRate * 1000) / 10,
      lift: baseRate ? Math.round((followRate / baseRate) * 100) / 100 : 0,
    },
    recent: { last25: rate(25), last50: rate(50), last100: rate(100), lifetime: Math.round(baseRate * 1000) / 10 },
  };
}

export function sumDistribution(draws) {
  const sums = draws.map((d) => drawNumbers(d).reduce((s, n) => s + n, 0));
  sums.sort((a, b) => a - b);
  const mean = sums.reduce((s, x) => s + x, 0) / (sums.length || 1);
  const p = (q) => sums[Math.floor(q * (sums.length - 1))] || 0;
  return { mean: Math.round(mean), min: sums[0], max: sums[sums.length - 1], p10: p(0.1), p90: p(0.9) };
}
