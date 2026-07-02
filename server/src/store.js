// אחסון בזיכרון, מאותחל מ-seedData.json (dataset קפוא שמגיע עם ה-build).
// בסביבת serverless הכתיבה אפמרית (לכל instance) — מתאים לדמו חי ללא DB חיצוני.
import seedData from './seedData.json' with { type: 'json' };

const state = {
  draws: [],
  predictions: [],
  predictionResults: [],
  modelPerformance: [],
  seqDraw: 0,
  seqPred: 0,
  seqRes: 0,
  seqPerf: 0,
};

function loadSeed() {
  if (state.draws.length) return;
  state.draws = seedData.map((d) => ({ ...d }));
  state.seqDraw = Math.max(0, ...state.draws.map((d) => d.id));
  state.draws.sort((a, b) => a.draw_number - b.draw_number);
}
loadSeed();

export function getAllDraws() {
  return state.draws.slice().sort((a, b) => a.draw_number - b.draw_number);
}

export function getLatestDraw() {
  if (!state.draws.length) return null;
  return state.draws.reduce((a, b) => (b.draw_number > a.draw_number ? b : a));
}

export function getDrawCount() {
  return state.draws.length;
}

export function insertDraw(rec) {
  if (state.draws.some((d) => d.draw_number === rec.draw_number)) return false;
  const nums = rec.numbers ? [...rec.numbers].sort((a, b) => a - b) : [rec.n1, rec.n2, rec.n3, rec.n4, rec.n5, rec.n6];
  state.draws.push({
    id: ++state.seqDraw,
    draw_number: rec.draw_number,
    draw_date: rec.draw_date,
    n1: nums[0], n2: nums[1], n3: nums[2], n4: nums[3], n5: nums[4], n6: nums[5],
    strong_number: rec.strong_number,
    source: rec.source || 'seed',
    source_url: rec.source_url || null,
    fetched_at: rec.fetched_at || new Date().toISOString(),
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  });
  return true;
}

export function insertManyDraws(records) {
  let added = 0;
  for (const r of records) if (insertDraw(r)) added++;
  return added;
}

// --- predictions ---
export function savePrediction(p) {
  const id = ++state.seqPred;
  state.predictions.push({
    id,
    target_draw_number: p.target_draw_number,
    target_draw_date: p.target_draw_date || null,
    model_name: p.model_name,
    numbers_json: JSON.stringify(p.numbers),
    strong_number: p.strong_number,
    score: p.score,
    explanation: p.explanation || null,
    created_at: new Date().toISOString(),
  });
  return id;
}

export function getPredictionsForDraw(drawNumber) {
  return state.predictions.filter((p) => p.target_draw_number === drawNumber).sort((a, b) => b.id - a.id);
}

export function clearPredictionsForDraw(drawNumber) {
  state.predictions = state.predictions.filter((p) => p.target_draw_number !== drawNumber);
}

export function getLatestPredictions() {
  if (!state.predictions.length) return [];
  const maxTarget = Math.max(...state.predictions.map((p) => p.target_draw_number));
  return getPredictionsForDraw(maxTarget);
}

export function savePredictionResult(r) {
  state.predictionResults.push({ id: ++state.seqRes, ...r, checked_at: new Date().toISOString() });
}

export function saveModelPerformance(p) {
  state.modelPerformance.push({ id: ++state.seqPerf, ...p, created_at: new Date().toISOString() });
}

export function getModelPerformance() {
  // הרשומה האחרונה לכל מודל
  const byModel = new Map();
  for (const p of state.modelPerformance) {
    const prev = byModel.get(p.model_name);
    if (!prev || p.id > prev.id) byModel.set(p.model_name, p);
  }
  return [...byModel.values()].sort((a, b) => b.improvement_vs_random - a.improvement_vs_random);
}

export default state;
