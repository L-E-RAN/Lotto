import { MAX_NUMBER, STRONG_MAX, PICK } from './config.js';
import { numberStats, strongStats, pairStats, sumDistribution, drawNumbers } from './stats.js';
import { passesFilters, keyOf, humanLikenessPenalty } from './filters.js';

// ---------- בניית וקטורי ניקוד לכל מספר (1..37) ----------
function norm(arr) {
  const max = Math.max(...arr, 1);
  return arr.map((v) => v / max);
}

export function buildContext(draws) {
  const nstats = numberStats(draws);
  const sstats = strongStats(draws);
  const pstats = pairStats(draws);
  const sumDist = sumDistribution(draws);
  const existingSet = new Set(draws.map((d) => keyOf(drawNumbers(d))));

  // ניקוד זוגות לכל מספר: סכום שכיחות הזוגות שהוא משתתף בהם
  const pairScore = new Array(MAX_NUMBER + 1).fill(0);
  for (const pr of pstats.all) { pairScore[pr.a] += pr.count; pairScore[pr.b] += pr.count; }

  const sumMin = Math.max(60, sumDist.p10 - 5);
  const sumMax = Math.min(200, sumDist.p90 + 5);

  return { draws, nstats, sstats, pstats, sumDist, existingSet, pairScore, sumMin, sumMax };
}

// כל מודל מחזיר ניקוד[1..37]
function scoreVectors(ctx) {
  const { nstats, pairScore } = ctx;
  const freq = nstats.map((s) => s.count);
  const recent = nstats.map((s) => s.last25);
  const overdue = nstats.map((s) => s.drawsSince);
  const pairs = pairScore.slice(1);

  const fN = norm(freq), rN = norm(recent), oN = norm(overdue), pN = norm(pairs);

  const hot = nstats.map((s, i) => rN[i] * 0.7 + fN[i] * 0.3);
  const cold = nstats.map((s, i) => oN[i]);
  const weighted = nstats.map((s, i) =>
    fN[i] * 0.25 + rN[i] * 0.25 + oN[i] * 0.20 + pN[i] * 0.15 +
    (1 - humanLikenessPenalty([s.number, s.number]) / 100) * 0.15 // patternScore proxy
  );
  const pair = nstats.map((s, i) => pN[i]);

  // anti_popularity: מעדיף מספרים גבוהים/פחות "אנושיים"
  const anti = nstats.map((s, i) => {
    let v = fN[i] * 0.4 + rN[i] * 0.2;
    if (s.number > 31) v += 0.4;
    if (s.number > 19) v += 0.2;
    return v;
  });

  return { hot, cold, weighted, pair, anti };
}

// בחירת 6 מספרים לפי וקטור ניקוד שעומדים בכללי הסינון
function selectByScores(scoreVec, ctx, opts = {}) {
  const { aggressive = false, antiPop = false } = opts;
  const ctxFilter = { sumMin: ctx.sumMin, sumMax: ctx.sumMax, existingSet: ctx.existingSet };
  const ranked = scoreVec
    .map((score, i) => ({ number: i + 1, score }))
    .sort((a, b) => b.score - a.score);

  // ניסיון: דגימה משוקללת חוזרת עד שעוברים את הסינון
  const topPool = ranked.slice(0, aggressive ? MAX_NUMBER : 22);
  let best = null;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const pick = weightedSample(topPool, PICK, aggressive);
    const nums = pick.map((p) => p.number);
    const f = passesFilters(nums, ctxFilter);
    let s = pick.reduce((sum, p) => sum + p.score, 0);
    if (antiPop) s -= humanLikenessPenalty(nums) / 100;
    if (f.ok) {
      if (!best || s > best.score) best = { nums, score: s, pattern: f.pattern };
      if (attempt > 800) break; // מספיק ניסיונות מוצלחים
    }
  }
  if (!best) {
    // נפילה אחורה: פשוט קח את ה-top 6
    const nums = ranked.slice(0, PICK).map((r) => r.number);
    best = { nums, score: ranked.slice(0, PICK).reduce((s, r) => s + r.score, 0), pattern: passesFilters(nums, ctxFilter).pattern };
  }
  best.nums.sort((a, b) => a - b);
  return best;
}

function weightedSample(pool, k, uniform = false) {
  const chosen = [];
  const avail = [...pool];
  for (let i = 0; i < k && avail.length; i++) {
    const total = uniform ? avail.length : avail.reduce((s, p) => s + Math.max(p.score, 0.001), 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < avail.length; j++) {
      r -= uniform ? 1 : Math.max(avail[j].score, 0.001);
      if (r <= 0) { idx = j; break; }
    }
    chosen.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return chosen;
}

function pickStrong(ctx, mode = 'hot') {
  const { list, hot, cold } = ctx.sstats;
  if (mode === 'cold') return cold[0];
  if (mode === 'balanced') {
    // המספר החזק עם ה"איחור" הגדול ביותר מבין החמים-בינוניים
    const sorted = [...list].sort((a, b) => b.drawsSince - a.drawsSince);
    return sorted[0].number;
  }
  return hot[0];
}

// ---------- random_filtered_model ----------
function randomFiltered(ctx) {
  const ctxFilter = { sumMin: ctx.sumMin, sumMax: ctx.sumMax, existingSet: ctx.existingSet };
  const candidates = [];
  for (let i = 0; i < 6000 && candidates.length < 400; i++) {
    const nums = randomCombo();
    const f = passesFilters(nums, ctxFilter);
    if (!f.ok) continue;
    // דירוג לפי ניקוד תדירות פחות "אנושיות"
    const freqScore = nums.reduce((s, n) => s + ctx.nstats[n - 1].count, 0);
    const score = freqScore - humanLikenessPenalty(nums);
    candidates.push({ nums: nums.sort((a, b) => a - b), score, pattern: f.pattern });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || selectByScores(ctx.nstats.map((s) => s.count), ctx);
}

function randomCombo() {
  const set = new Set();
  while (set.size < PICK) set.add(1 + Math.floor(Math.random() * MAX_NUMBER));
  return [...set];
}

// בחירה דטרמיניסטית מהירה (לשימוש ב-Backtesting) — top שעובר סינון
function greedySelect(scoreVec, ctx) {
  const ctxFilter = { sumMin: ctx.sumMin, sumMax: ctx.sumMax, existingSet: ctx.existingSet };
  const ranked = scoreVec
    .map((score, i) => ({ number: i + 1, score }))
    .sort((a, b) => b.score - a.score);
  // הוסף מספרים לפי דירוג; אם הצירוף הסופי לא עובר סינון, נסה החלפות מהפול
  let nums = ranked.slice(0, PICK).map((r) => r.number);
  if (passesFilters(nums, ctxFilter).ok) { nums.sort((a, b) => a - b); return { nums, score: 0 }; }
  // ניסיון מוגבל: בנה בהדרגה תוך שמירה על איזון
  const pool = ranked.slice(0, 24).map((r) => r.number);
  for (let tries = 0; tries < 300; tries++) {
    const cand = [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, PICK);
    cand.push(...shuffled);
    if (passesFilters(cand, ctxFilter).ok) { cand.sort((a, b) => a - b); return { nums: cand, score: 0 }; }
  }
  nums.sort((a, b) => a - b);
  return { nums, score: 0 };
}

export function runModelFast(name, ctx) {
  const vecs = scoreVectors(ctx);
  const vec = vecs[{
    hot_numbers_model: 'hot', cold_numbers_model: 'cold', weighted_model: 'weighted',
    pair_model: 'pair', anti_popularity_model: 'anti',
  }[name] || 'weighted'];
  let result;
  if (name === 'random_filtered_model') result = randomFiltered(ctx);
  else result = greedySelect(vec, ctx);
  const strongMode = name === 'cold_numbers_model' ? 'cold' : name === 'hot_numbers_model' ? 'hot' : 'balanced';
  return { numbers: result.nums, strong: pickStrong(ctx, strongMode) };
}

// ---------- API ראשי: הרצת מודל לפי שם ----------
export const MODEL_NAMES = [
  'hot_numbers_model',
  'cold_numbers_model',
  'weighted_model',
  'pair_model',
  'anti_popularity_model',
  'random_filtered_model',
];

export function runModel(name, ctx) {
  const vecs = scoreVectors(ctx);
  let result, strongMode = 'hot';
  switch (name) {
    case 'hot_numbers_model': result = selectByScores(vecs.hot, ctx); strongMode = 'hot'; break;
    case 'cold_numbers_model': result = selectByScores(vecs.cold, ctx); strongMode = 'cold'; break;
    case 'weighted_model': result = selectByScores(vecs.weighted, ctx); strongMode = 'balanced'; break;
    case 'pair_model': result = selectByScores(vecs.pair, ctx); strongMode = 'hot'; break;
    case 'anti_popularity_model': result = selectByScores(vecs.anti, ctx, { antiPop: true }); strongMode = 'balanced'; break;
    case 'random_filtered_model': result = randomFiltered(ctx); strongMode = 'balanced'; break;
    default: throw new Error('unknown model ' + name);
  }
  const strong = pickStrong(ctx, strongMode);
  const score = Math.round(normScore(result.score) * 100) / 100;
  return { model_name: name, numbers: result.nums, strong, score, pattern: result.pattern };
}

function normScore(s) {
  // מנרמל לסקלה 0..100 לתצוגה
  return Math.max(0, Math.min(100, 50 + s * 8));
}

// שלוש תחזיות מוצגות: ראשית / מאוזנת / אגרסיבית
export function threePredictions(ctx) {
  const main = runModel('weighted_model', ctx);
  const balanced = runModel('pair_model', ctx);
  const aggressive = runModel('anti_popularity_model', ctx);
  return [
    { label: 'תחזית ראשית', ...main },
    { label: 'תחזית מאוזנת', ...balanced },
    { label: 'תחזית אגרסיבית', ...aggressive },
  ];
}
