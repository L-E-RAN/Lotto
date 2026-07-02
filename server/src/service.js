import {
  getAllDraws, getLatestDraw, insertManyDraws, savePrediction,
  getPredictionsForDraw, clearPredictionsForDraw, savePredictionResult, saveModelPerformance, getModelPerformance,
} from './store.js';
import { buildContext, threePredictions, runModel, MODEL_NAMES } from './engine/models.js';
import { explainNumbers } from './engine/explain.js';
import { backtestAll } from './engine/backtest.js';
import { drawNumbers, strongStats } from './engine/stats.js';
import { generateInsightTickets, confidencePrediction } from './engine/insights.js';
import { fetchLatestDraws } from './fetcher.js';
import { DISCLAIMER } from './engine/config.js';

export function buildCtxFromDb() {
  return buildContext(getAllDraws());
}

// יוצר ושומר 8 תחזיות להגרלה הבאה (כולל תחזית ביטחון מבוססת-הסתברות)
export function generateNextPredictions() {
  const draws = getAllDraws();
  if (draws.length < 10) return { predictions: [], message: 'אין מספיק נתונים' };
  const ctx = buildContext(draws);
  const latest = draws[draws.length - 1];
  const targetNumber = latest.draw_number + 1;
  const ss = strongStats(draws);
  clearPredictionsForDraw(targetNumber); // מחליף תחזיות קודמות לאותה הגרלה (מונע כפילויות)

  const specs = [];

  // 6 מודלים סטטיסטיים
  const modelLabels = [
    ['weighted_model', 'תחזית ראשית'],
    ['pair_model', 'תחזית מאוזנת'],
    ['anti_popularity_model', 'תחזית אגרסיבית'],
    ['hot_numbers_model', 'תחזית מספרים חמים'],
    ['cold_numbers_model', 'תחזית מספרים קרים'],
    ['random_filtered_model', 'תחזית אקראית מסוננת'],
  ];
  for (const [model, label] of modelLabels) {
    const p = runModel(model, ctx);
    specs.push({
      model_name: model, label, numbers: p.numbers, strong: p.strong, score: p.score,
      meta: { label, perNumber: explainNumbers(p.numbers, ctx), pattern: p.pattern },
    });
  }

  // תחזית תובנות משולבת (מסנתזת את כל הניתוחים)
  const insight = generateInsightTickets(draws, ctx, 1).tickets[0];
  specs.push({
    model_name: 'insight_model', label: 'תחזית תובנות משולבת',
    numbers: insight.numbers, strong: insight.strong, score: insight.score,
    meta: { label: 'תחזית תובנות משולבת', perNumber: insight.reasons.map((r) => ({ number: r.number, reasons: r.tags })), pattern: insight.pattern },
  });

  // תחזית ביטחון — ≥5 מספרים עם הסתברות >50% להופיע תוך K הגרלות
  const conf = confidencePrediction(draws, ss);
  specs.push({
    model_name: 'confidence_model', label: `תחזית ביטחון גבוה (הופעה תוך ${conf.withinK} הגרלות)`,
    numbers: conf.numbers, strong: conf.strong, score: conf.above50 * 10,
    meta: { label: `תחזית ביטחון גבוה`, confidence: conf, perNumber: conf.perNumberProb.map((x) => ({ number: x.number, reasons: [`הסתברות ${x.prob}% להופיע תוך ${conf.withinK} הגרלות`] })) },
  });

  const preds = specs.map((s) => {
    const id = savePrediction({
      target_draw_number: targetNumber, target_draw_date: null,
      model_name: s.model_name, numbers: s.numbers, strong_number: s.strong, score: s.score,
      explanation: JSON.stringify(s.meta),
    });
    return { id, ...s, target_draw_number: targetNumber, perNumber: s.meta.perNumber, disclaimer: DISCLAIMER };
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
