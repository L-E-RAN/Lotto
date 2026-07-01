import {
  getAllDraws, getLatestDraw, insertManyDraws, savePrediction,
  getPredictionsForDraw, savePredictionResult, saveModelPerformance, getModelPerformance,
} from './store.js';
import { buildContext, threePredictions, runModel, MODEL_NAMES } from './engine/models.js';
import { explainNumbers } from './engine/explain.js';
import { backtestAll } from './engine/backtest.js';
import { drawNumbers } from './engine/stats.js';
import { fetchLatestDraws } from './fetcher.js';
import { DISCLAIMER } from './engine/config.js';

export function buildCtxFromDb() {
  return buildContext(getAllDraws());
}

// יוצר ושומר 3 תחזיות להגרלה הבאה
export function generateNextPredictions() {
  const draws = getAllDraws();
  if (draws.length < 10) return { predictions: [], message: 'אין מספיק נתונים' };
  const ctx = buildContext(draws);
  const latest = draws[draws.length - 1];
  const targetNumber = latest.draw_number + 1;

  const preds = threePredictions(ctx).map((p) => {
    const explanation = explainNumbers(p.numbers, ctx);
    const id = savePrediction({
      target_draw_number: targetNumber,
      target_draw_date: null,
      model_name: p.model_name,
      numbers: p.numbers,
      strong_number: p.strong,
      score: p.score,
      explanation: JSON.stringify({ label: p.label, perNumber: explanation, pattern: p.pattern }),
    });
    return { id, ...p, target_draw_number: targetNumber, perNumber: explanation, disclaimer: DISCLAIMER };
  });
  return { predictions: preds, target_draw_number: targetNumber, disclaimer: DISCLAIMER };
}

// בודק את התחזיות שמיועדות להגרלה שזה עתה נכנסה
export function checkPredictionsAgainst(actualDraw) {
  const preds = getPredictionsForDraw(actualDraw.draw_number);
  const actualNums = new Set(drawNumbers(actualDraw));
  let checked = 0;
  for (const p of preds) {
    const nums = JSON.parse(p.numbers_json);
    const hits = nums.filter((n) => actualNums.has(n)).length;
    const strongHit = p.strong_number === actualDraw.strong_number ? 1 : 0;
    savePredictionResult({
      prediction_id: p.id,
      actual_draw_id: actualDraw.id,
      regular_hits: hits,
      strong_hit: strongHit,
      total_score: hits + strongHit * 0.5,
    });
    checked++;
  }
  return checked;
}

// מריץ Backtesting ושומר ביצועים לכל מודל
export function refreshModelPerformance(opts = {}) {
  const draws = getAllDraws();
  if (draws.length < 120) return [];
  const results = backtestAll(draws, opts);
  for (const r of results) {
    saveModelPerformance({
      model_name: r.model_name,
      test_from_draw: r.test_from_draw,
      test_to_draw: r.test_to_draw,
      avg_hits: r.avg_hits,
      std_hits: r.std_hits,
      hit_1_plus: r.hit_1_plus,
      hit_2_plus: r.hit_2_plus,
      hit_3_plus: r.hit_3_plus,
      strong_hit_rate: r.strong_hit_rate,
      random_avg_hits: r.random_avg_hits,
      random_std_hits: r.random_std_hits,
      random_strong_rate: r.random_strong_rate,
      improvement_vs_random: r.improvement_vs_random,
      z_score: r.z_score,
      p_value: r.p_value,
      significant: r.significant,
      verdict: r.verdict,
    });
  }
  return results;
}

// סנכרון אוטומטי עם throttle — נקרא בכניסה לדף ההגרלות.
let lastAutoSync = 0;
let lastAutoResult = null;
const AUTO_SYNC_TTL = 5 * 60 * 1000; // 5 דקות
export async function autoSync() {
  const now = Date.now();
  if (lastAutoResult && now - lastAutoSync < AUTO_SYNC_TTL) {
    return { ...lastAutoResult, cached: true, nextSyncInSec: Math.round((AUTO_SYNC_TTL - (now - lastAutoSync)) / 1000) };
  }
  lastAutoSync = now;
  lastAutoResult = await syncDraws();
  return { ...lastAutoResult, cached: false };
}

// סנכרון מלא: משיכה -> שמירה -> בדיקת תחזיות -> ביצועים -> תחזית חדשה
export async function syncDraws() {
  const fetched = await fetchLatestDraws();
  let added = 0;
  if (fetched.length) added = insertManyDraws(fetched);

  const result = { fetched: fetched.length, added, source: fetched.length ? (fetched[0].source || 'pais') : 'none' };

  if (added > 0) {
    const latest = getLatestDraw();
    result.checkedPredictions = checkPredictionsAgainst(latest);
    refreshModelPerformance();
    const gen = generateNextPredictions();
    result.newTarget = gen.target_draw_number;
  }
  return result;
}

export { getModelPerformance, MODEL_NAMES, DISCLAIMER };
