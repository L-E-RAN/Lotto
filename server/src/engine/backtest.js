import { buildContext, runModelFast, MODEL_NAMES } from './models.js';
import { drawNumbers } from './stats.js';
import { PICK } from './config.js';

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

  let tests = 0, sumHits = 0, h1 = 0, h2 = 0, h3 = 0, strongHits = 0;
  for (let i = start; i < sorted.length; i++) {
    const history = sorted.slice(0, i);
    const actual = sorted[i];
    const ctx = buildContext(history);
    const pred = runModelFast(modelName, ctx);
    const hits = countHits(pred.numbers, drawNumbers(actual));
    sumHits += hits;
    if (hits >= 1) h1++;
    if (hits >= 2) h2++;
    if (hits >= 3) h3++;
    if (pred.strong === actual.strong_number) strongHits++;
    tests++;
  }
  const base = randomBaseline();
  const avg = tests ? sumHits / tests : 0;
  return {
    model_name: modelName,
    test_from_draw: sorted[start]?.draw_number ?? null,
    test_to_draw: sorted[sorted.length - 1]?.draw_number ?? null,
    tests,
    avg_hits: Math.round(avg * 1000) / 1000,
    hit_1_plus: tests ? Math.round((h1 / tests) * 1000) / 10 : 0,
    hit_2_plus: tests ? Math.round((h2 / tests) * 1000) / 10 : 0,
    hit_3_plus: tests ? Math.round((h3 / tests) * 1000) / 10 : 0,
    strong_hit_rate: tests ? Math.round((strongHits / tests) * 1000) / 10 : 0,
    random_avg_hits: base.avg,
    random_baseline: base,
    improvement_vs_random: Math.round((avg - base.avg) * 1000) / 1000,
  };
}

export function backtestAll(allDraws, opts = {}) {
  return MODEL_NAMES.map((m) => backtestModel(m, allDraws, opts));
}
