import { buildContext, runModelFast, MODEL_NAMES } from './models.js';
import { drawNumbers } from './stats.js';
import { PICK, MAX_NUMBER } from './config.js';
import { mean, stdDev, zTestDiff } from './statTests.js';

function randomTicket() {
  const set = new Set();
  while (set.size < PICK) set.add(1 + Math.floor(Math.random() * MAX_NUMBER));
  return [...set];
}

function countHits(predicted, actual) {
  const set = new Set(actual);
  return predicted.filter((n) => set.has(n)).length;
}

// השוואת מודל אקראי תיאורטי: תוחלת פגיעות בהוצאת 6 מתוך 37 = 6*6/37
function randomBaseline() {
  const expected = (PICK * PICK) / 37; // ~0.973
  // הסתברויות בינום-היפר-גאומטרי
  const p1 = 1 - hyperNoHit(0);
  const p2 = 1 - hyperNoHit(0) - hyperNoHit(1);
  const p3 = 1 - hyperNoHit(0) - hyperNoHit(1) - hyperNoHit(2);
  return {
    avg: Math.round(expected * 1000) / 1000,
    hit1: Math.round(p1 * 1000) / 10,
    hit2: Math.round(p2 * 1000) / 10,
    hit3: Math.round(p3 * 1000) / 10,
    strong: Math.round((1 / 7) * 1000) / 10,
  };
}
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
function hyperNoHit(h) {
  // P(בדיוק h פגיעות) כשמוציאים 6 מתוך 37 ויש 6 "מנצחים"
  return (comb(6, h) * comb(31, 6 - h)) / comb(37, 6);
}

// הרצת backtest walk-forward עבור מודל יחיד
export function backtestModel(modelName, allDraws, opts = {}) {
  const { minHistory = 100, maxTests = 300 } = opts;
  const sorted = [...allDraws].sort((a, b) => a.draw_number - b.draw_number);
  const start = Math.max(minHistory, sorted.length - maxTests);

  const modelHits = [], empHits = [];
  let h1 = 0, h2 = 0, h3 = 0, strongHits = 0, empStrongHits = 0;
  for (let i = start; i < sorted.length; i++) {
    const history = sorted.slice(0, i);
    const actual = sorted[i];
    const actualNums = drawNumbers(actual);
    const ctx = buildContext(history);
    const pred = runModelFast(modelName, ctx);
    const hits = countHits(pred.numbers, actualNums);
    modelHits.push(hits);
    if (hits >= 1) h1++;
    if (hits >= 2) h2++;
    if (hits >= 3) h3++;
    if (pred.strong === actual.strong_number) strongHits++;
    // baseline אמפירי: טור אקראי אמיתי על אותה הגרלה
    empHits.push(countHits(randomTicket(), actualNums));
    if ((1 + Math.floor(Math.random() * 7)) === actual.strong_number) empStrongHits++;
  }
  const tests = modelHits.length;
  const avg = mean(modelHits), sd = stdDev(modelHits);
  const empAvg = mean(empHits), empSd = stdDev(empHits);
  const theo = randomBaseline();
  const sig = zTestDiff(avg, sd, tests, empAvg, empSd, tests);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const pct = (x) => Math.round((x / tests) * 1000) / 10;

  return {
    model_name: modelName,
    test_from_draw: sorted[start]?.draw_number ?? null,
    test_to_draw: sorted[sorted.length - 1]?.draw_number ?? null,
    tests,
    avg_hits: r3(avg),
    std_hits: r3(sd),
    hit_1_plus: pct(h1),
    hit_2_plus: pct(h2),
    hit_3_plus: pct(h3),
    strong_hit_rate: pct(strongHits),
    random_avg_hits: r3(empAvg),
    random_std_hits: r3(empSd),
    random_strong_rate: pct(empStrongHits),
    random_theoretical: theo,
    improvement_vs_random: r3(avg - empAvg),
    z_score: sig.z,
    p_value: sig.pValue,
    significant: sig.significant,
    verdict: sig.significant
      ? (avg > empAvg
        ? 'המודל עולה על אקראי באופן מובהק (p<0.05) בטווח הנבדק.'
        : 'המודל נחות מאקראי באופן מובהק (p<0.05) בטווח הנבדק.')
      : 'אין הבדל מובהק בין המודל לבחירה אקראית (p≥0.05). זו תוצאה צפויה — תוצאות לוטו אקראיות.',
  };
}

export function backtestAll(allDraws, opts = {}) {
  return MODEL_NAMES.map((m) => backtestModel(m, allDraws, opts));
}
