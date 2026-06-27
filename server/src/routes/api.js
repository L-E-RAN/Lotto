import express from 'express';
import { getAllDraws, getLatestDraw, getLatestPredictions } from '../store.js';
import {
  numberStats, strongStats, pairStats, tripleStats, sumDistribution, patternOf, drawNumbers,
} from '../engine/stats.js';
import { buildContext } from '../engine/models.js';
import { backtestModel, backtestAll } from '../engine/backtest.js';
import { chiSquareUniform } from '../engine/statTests.js';
import { generateTickets, costAndOdds } from '../engine/wheel.js';
import { insertManyDraws } from '../store.js';
import {
  generateNextPredictions, refreshModelPerformance, getModelPerformance, syncDraws, MODEL_NAMES,
} from '../service.js';
import { DISCLAIMER } from '../engine/config.js';

const router = express.Router();
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'שגיאת שרת', detail: e.message });
});

// ---------- DRAWS ----------
router.get('/draws', wrap((req, res) => {
  let draws = getAllDraws();
  const { year, q, date, number, limit } = req.query;
  if (year) draws = draws.filter((d) => d.draw_date?.startsWith(String(year)));
  if (date) draws = draws.filter((d) => d.draw_date === date);
  if (number) draws = draws.filter((d) => String(d.draw_number) === String(number));
  if (q) {
    const s = String(q);
    draws = draws.filter((d) => String(d.draw_number).includes(s) || d.draw_date?.includes(s));
  }
  draws = draws.sort((a, b) => b.draw_number - a.draw_number);
  const total = draws.length;
  if (limit) draws = draws.slice(0, parseInt(limit, 10));
  const years = [...new Set(getAllDraws().map((d) => d.draw_date?.slice(0, 4)).filter(Boolean))].sort().reverse();
  res.json({ total, draws, years });
}));

router.get('/draws/latest', wrap((req, res) => {
  const latest = getLatestDraw();
  if (!latest) return res.status(404).json({ error: 'אין נתונים' });
  res.json(latest);
}));

const syncHandler = wrap(async (req, res) => {
  const result = await syncDraws();
  res.json(result);
});
router.post('/draws/sync', syncHandler);
router.get('/draws/sync', syncHandler); // alias ל-Vercel Cron (GET)

// ---------- STATS ----------
router.get('/stats/numbers', wrap((req, res) => {
  const draws = getAllDraws();
  res.json({ total: draws.length, numbers: numberStats(draws) });
}));

router.get('/stats/strong', wrap((req, res) => {
  const draws = getAllDraws();
  res.json(strongStats(draws));
}));

router.get('/stats/pairs', wrap((req, res) => {
  const draws = getAllDraws();
  res.json(pairStats(draws, parseInt(req.query.limit || '30', 10)));
}));

router.get('/stats/triples', wrap((req, res) => {
  const draws = getAllDraws();
  res.json({ triples: tripleStats(draws, parseInt(req.query.limit || '20', 10)) });
}));

// סיכום לדשבורד: חמים / קרים / מאחרים
router.get('/stats/summary', wrap((req, res) => {
  const draws = getAllDraws();
  const ns = numberStats(draws);
  const hot = [...ns].sort((a, b) => b.last25 - a.last25).slice(0, 8);
  const cold = [...ns].sort((a, b) => a.last25 - b.last25).slice(0, 8);
  const overdue = [...ns].sort((a, b) => b.drawsSince - a.drawsSince).slice(0, 8);
  res.json({
    total: draws.length,
    latest: getLatestDraw(),
    hot, cold, overdue,
    sum: sumDistribution(draws),
    strong: strongStats(draws),
  });
}));

// ניתוח תבניות של ההגרלות + תבנית של תחזית/צירוף נתון
router.get('/stats/patterns', wrap((req, res) => {
  const draws = getAllDraws();
  const dist = { even: {}, low: {}, sum: [], sequences: 0, birthdayLike: 0 };
  for (const d of draws) {
    const p = patternOf(drawNumbers(d));
    dist.even[p.even] = (dist.even[p.even] || 0) + 1;
    dist.low[p.low] = (dist.low[p.low] || 0) + 1;
    dist.sum.push(p.sum);
    if (p.sequences > 0) dist.sequences++;
    if (p.birthdayLike) dist.birthdayLike++;
  }
  // היסטוגרמת סכומים
  const buckets = {};
  for (const s of dist.sum) { const b = Math.floor(s / 10) * 10; buckets[b] = (buckets[b] || 0) + 1; }
  res.json({
    total: draws.length,
    evenSplit: dist.even,
    lowSplit: dist.low,
    sumHistogram: Object.entries(buckets).map(([k, v]) => ({ bucket: +k, count: v })).sort((a, b) => a.bucket - b.bucket),
    sequencesPct: draws.length ? Math.round((dist.sequences / draws.length) * 1000) / 10 : 0,
    birthdayLikePct: draws.length ? Math.round((dist.birthdayLike / draws.length) * 1000) / 10 : 0,
    sumStats: sumDistribution(draws),
  });
}));

// בדיקת צירוף נתון (למסך תבניות)
router.post('/stats/analyze', wrap((req, res) => {
  const nums = (req.body?.numbers || []).map(Number);
  if (nums.length !== 6) return res.status(400).json({ error: 'יש לשלוח 6 מספרים' });
  res.json({ numbers: nums.sort((a, b) => a - b), pattern: patternOf(nums) });
}));

// מבחני אקראיות — Chi-square על התפלגות המספרים והמספר החזק
router.get('/stats/randomness', wrap((req, res) => {
  const draws = getAllDraws();
  const ns = numberStats(draws);
  const numberCounts = ns.map((s) => s.count);
  const totalNumberObs = numberCounts.reduce((a, b) => a + b, 0); // = 6*N
  const ss = strongStats(draws);
  const strongCounts = ss.list.map((s) => s.count);
  const totalStrongObs = strongCounts.reduce((a, b) => a + b, 0); // = N
  res.json({
    total: draws.length,
    numbers: chiSquareUniform(numberCounts, totalNumberObs),
    strong: chiSquareUniform(strongCounts, totalStrongObs),
    note: 'מבחן טיב-התאמה לאחידות. p≥0.05 = אין עדות סטטיסטית להטיה; חם/קר הם תנודות אקראיות צפויות.',
  });
}));

// ---------- TOOLS: מחולל טורים ----------
router.post('/tools/wheel', wrap((req, res) => {
  const draws = getAllDraws();
  const ctx = buildContext(draws);
  const count = Number(req.body?.count) || 6;
  const pool = Array.isArray(req.body?.pool) ? req.body.pool.map(Number) : null;
  const gen = generateTickets(ctx, { count, pool });
  res.json({ ...gen, economics: costAndOdds(gen.tickets.length), disclaimer: DISCLAIMER });
}));

// ---------- ייבוא נתונים אמיתיים (CSV/מערך) ----------
router.post('/draws/import', wrap((req, res) => {
  let records = [];
  if (Array.isArray(req.body?.draws)) {
    records = req.body.draws;
  } else if (typeof req.body?.csv === 'string') {
    records = parseImportCsv(req.body.csv);
  } else {
    return res.status(400).json({ error: 'שלח csv (טקסט) או draws (מערך)' });
  }
  const valid = records.filter((r) =>
    Number.isInteger(r.draw_number) && Array.isArray(r.numbers) && r.numbers.length === 6 &&
    r.numbers.every((n) => n >= 1 && n <= 37) && r.strong_number >= 1 && r.strong_number <= 7);
  const added = insertManyDraws(valid.map((r) => ({ ...r, source: r.source || 'import' })));
  res.json({ received: records.length, valid: valid.length, added });
}));

function parseImportCsv(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(/[,\t;]/).map((x) => x.trim());
    const dn = parseInt(c[0], 10);
    if (!Number.isInteger(dn)) continue;
    const nums = c.slice(2, 8).map((x) => parseInt(x, 10));
    const strong = parseInt(c[8], 10);
    if (nums.some((n) => !Number.isInteger(n))) continue;
    out.push({ draw_number: dn, draw_date: c[1] || null, numbers: nums, strong_number: strong });
  }
  return out;
}

// ---------- PREDICTIONS ----------
router.get('/predictions/next', wrap((req, res) => {
  let preds = getLatestPredictions();
  if (!preds.length) {
    const gen = generateNextPredictions();
    return res.json({ ...gen, disclaimer: DISCLAIMER });
  }
  const draws = getAllDraws();
  const ctx = buildContext(draws);
  const perf = getModelPerformance();
  const enriched = preds.map((p) => {
    const meta = p.explanation ? JSON.parse(p.explanation) : {};
    const mp = perf.find((x) => x.model_name === p.model_name);
    return {
      id: p.id,
      label: meta.label || p.model_name,
      model_name: p.model_name,
      numbers: JSON.parse(p.numbers_json),
      strong: p.strong_number,
      score: p.score,
      perNumber: meta.perNumber || [],
      pattern: meta.pattern || null,
      performance: mp || null,
      backtestAvg: mp?.avg_hits ?? null,
      significant: mp?.significant ?? null,
      verdict: mp?.verdict ?? null,
      target_draw_number: p.target_draw_number,
    };
  });
  res.json({ predictions: enriched, target_draw_number: preds[0].target_draw_number, disclaimer: DISCLAIMER });
}));

router.post('/predictions/generate', wrap((req, res) => {
  const gen = generateNextPredictions();
  res.json({ ...gen, disclaimer: DISCLAIMER });
}));

// ---------- MODELS ----------
router.get('/models/performance', wrap((req, res) => {
  let perf = getModelPerformance();
  if (!perf.length) { refreshModelPerformance(); perf = getModelPerformance(); }
  res.json({ models: perf, modelNames: MODEL_NAMES, disclaimer: DISCLAIMER });
}));

// ---------- BACKTEST ----------
router.post('/backtest/run', wrap((req, res) => {
  const draws = getAllDraws();
  if (draws.length < 120) return res.status(400).json({ error: 'נדרשות לפחות 120 הגרלות ל-Backtesting' });
  const { model, maxTests = 200, minHistory = 100 } = req.body || {};
  const opts = { maxTests: Number(maxTests), minHistory: Number(minHistory) };
  const results = model && model !== 'all'
    ? [backtestModel(model, draws, opts)]
    : backtestAll(draws, opts);
  // שמירת הביצועים
  refreshModelPerformance(opts);
  res.json({ results, disclaimer: DISCLAIMER });
}));

export default router;
