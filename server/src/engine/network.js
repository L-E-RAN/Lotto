import { MAX_NUMBER, PICK } from './config.js';
import { drawNumbers, patternOf } from './stats.js';
import { passesFilters, keyOf, humanLikenessPenalty } from './filters.js';

// ----- בניית רשת קו-הופעה (co-occurrence) מכל ההגרלות -----
export function buildNetwork(draws) {
  const total = draws.length;
  const freq = new Array(MAX_NUMBER + 1).fill(0);
  const W = Array.from({ length: MAX_NUMBER + 1 }, () => new Array(MAX_NUMBER + 1).fill(0));

  for (const d of draws) {
    const nums = drawNumbers(d);
    for (const n of nums) freq[n]++;
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) { W[nums[i]][nums[j]]++; W[nums[j]][nums[i]]++; }
  }

  // עוצמת צומת = סכום משקלי הקשרים (= 5*תדירות), כלומר מרכזיות ≈ תדירות
  const nodes = [];
  for (let n = 1; n <= MAX_NUMBER; n++) {
    const degree = W[n].reduce((s, x) => s + x, 0);
    nodes.push({ number: n, freq: freq[n], degree, pct: total ? Math.round((freq[n] / total) * 1000) / 10 : 0 });
  }

  // ----- שכבות לפי מבנה הרשת (לא רק תדירות) -----
  // lift[i][j] = קו-הופעה נצפית / צפויה — קשר אמיתי בנטרול תדירות בסיס.
  const lift = Array.from({ length: MAX_NUMBER + 1 }, () => new Array(MAX_NUMBER + 1).fill(0));
  for (let i = 1; i <= MAX_NUMBER; i++)
    for (let j = i + 1; j <= MAX_NUMBER; j++) {
      const exp = total ? (freq[i] / total) * (freq[j] / total) * total : 0;
      const l = exp ? W[i][j] / exp : 0;
      lift[i][j] = l; lift[j][i] = l;
    }

  // גרף הקשרים המובהקים: משקל = עודף ה-lift מעל הצפוי (רק קשרים חיוביים מובהקים)
  const CUT = 1.05;
  const A = Array.from({ length: MAX_NUMBER + 1 }, () => new Array(MAX_NUMBER + 1).fill(0));
  for (let i = 1; i <= MAX_NUMBER; i++)
    for (let j = i + 1; j <= MAX_NUMBER; j++) if (lift[i][j] >= CUT) { const w = lift[i][j] - 1; A[i][j] = w; A[j][i] = w; }

  const eigen = eigenvectorCentrality(A);             // מרכזיות מבנית בגרף המובהק → ליבה
  const between = betweenness(lift, CUT);             // מתווכים בין אשכולות → גשר

  for (const node of nodes) { node.eigen = Math.round(eigen[node.number] * 1000) / 1000; node.between = Math.round(between[node.number] * 1000) / 1000; }

  // ליבה = 8 בעלי המרכזיות המבנית הגבוהה ביותר
  const byEigen = [...nodes].sort((a, b) => b.eigen - a.eigen);
  const coreSet = new Set(byEigen.slice(0, 8).map((n) => n.number));
  // גשר = מבין הנותרים, 12 בעלי ה-betweenness הגבוה (מחברים)
  const rest = byEigen.filter((n) => !coreSet.has(n.number)).sort((a, b) => b.between - a.between || b.eigen - a.eigen);
  const bridgeSet = new Set(rest.slice(0, 12).map((n) => n.number));

  for (const node of nodes) node.layer = coreSet.has(node.number) ? 'core' : bridgeSet.has(node.number) ? 'bridge' : 'periphery';
  // מיון תצוגה: ליבה לפי eigen, גשר לפי between, פריפריה לפי תדירות
  const byFreq = [...nodes].sort((a, b) => {
    const order = { core: 0, bridge: 1, periphery: 2 };
    if (order[a.layer] !== order[b.layer]) return order[a.layer] - order[b.layer];
    if (a.layer === 'core') return b.eigen - a.eigen;
    if (a.layer === 'bridge') return b.between - a.between;
    return b.freq - a.freq;
  });
  byFreq.forEach((node, i) => { node.rank = i + 1; });
  const layerOf = {};
  for (const node of byFreq) layerOf[node.number] = node.layer;

  // קשרים חזקים: לפי כמות קו-הופעה, עם lift = נצפה/צפוי (ביושר — חושף קשר אמיתי מעבר לתדירות)
  const pairs = [];
  for (let i = 1; i <= MAX_NUMBER; i++)
    for (let j = i + 1; j <= MAX_NUMBER; j++) {
      const w = W[i][j];
      if (!w) continue;
      const expected = total ? (freq[i] / total) * (freq[j] / total) * total : 0; // E[#draws עם שניהם]
      const lift = expected ? w / expected : 0;
      pairs.push({ a: i, b: j, count: w, lift: Math.round(lift * 100) / 100 });
    }
  const strongPairs = [...pairs].sort((x, y) => y.count - x.count).slice(0, 12);
  const strongestByLift = [...pairs].filter((p) => p.count >= 3).sort((x, y) => y.lift - x.lift).slice(0, 8);

  // סטטיסטיקות כלליות
  const appears = freq.slice(1);
  const top = [...nodes].sort((a, b) => b.freq - a.freq);
  const avg = appears.reduce((s, x) => s + x, 0) / MAX_NUMBER;
  const stats = {
    distinct: appears.filter((x) => x > 0).length,
    avgAppearances: Math.round((avg) * 100) / 100,
    topNumber: top[0]?.number,
    topCount: top[0]?.freq,
    totalDraws: total,
    minNumber: top[top.length - 1]?.number,
    minCount: top[top.length - 1]?.freq,
  };

  const layers = {
    core: byFreq.filter((n) => n.layer === 'core').map(slim),
    bridge: byFreq.filter((n) => n.layer === 'bridge').map(slim),
    periphery: byFreq.filter((n) => n.layer === 'periphery').map(slim),
  };

  const insights = buildInsights(byFreq, strongPairs, strongestByLift, layerOf, W);

  return { nodes: byFreq.map(slim), layers, strongPairs, strongestByLift, stats, topNumbers: top.slice(0, 5).map(slim), W, freq, layerOf, insights };
}

function slim(n) {
  return { number: n.number, freq: n.freq, pct: n.pct, layer: n.layer, rank: n.rank, eigen: n.eigen, between: n.between };
}

// מרכזיות וקטור-עצמי (power iteration) על מטריצת ה-lift
function eigenvectorCentrality(L) {
  const n = MAX_NUMBER;
  let x = new Array(n + 1).fill(1);
  for (let iter = 0; iter < 200; iter++) {
    const y = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= n; j++) y[i] += L[i][j] * x[j];
    const norm = Math.sqrt(y.reduce((s, v) => s + v * v, 0)) || 1;
    for (let i = 1; i <= n; i++) y[i] /= norm;
    let diff = 0; for (let i = 1; i <= n; i++) diff += Math.abs(y[i] - x[i]);
    x = y;
    if (diff < 1e-9) break;
  }
  // נרמול ל-0..1
  const max = Math.max(...x.slice(1)) || 1;
  const out = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) out[i] = x[i] / max;
  return out;
}

// betweenness centrality (Brandes) על גרף לא-משוקלל של קשרים מובהקים (lift>=cutoff)
function betweenness(L, cutoff) {
  const n = MAX_NUMBER;
  const adj = Array.from({ length: n + 1 }, () => []);
  for (let i = 1; i <= n; i++)
    for (let j = i + 1; j <= n; j++) if (L[i][j] >= cutoff) { adj[i].push(j); adj[j].push(i); }
  const CB = new Array(n + 1).fill(0);
  for (let s = 1; s <= n; s++) {
    const stack = [], pred = Array.from({ length: n + 1 }, () => []);
    const sigma = new Array(n + 1).fill(0), dist = new Array(n + 1).fill(-1);
    sigma[s] = 1; dist[s] = 0;
    const q = [s];
    while (q.length) {
      const v = q.shift(); stack.push(v);
      for (const w of adj[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; q.push(w); }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
      }
    }
    const delta = new Array(n + 1).fill(0);
    while (stack.length) {
      const w = stack.pop();
      for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) CB[w] += delta[w];
    }
  }
  const max = Math.max(...CB.slice(1)) || 1;
  const out = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) out[i] = CB[i] / max; // 0..1
  return out;
}

function buildInsights(byFreq, strongPairs, byLift, layerOf, W) {
  const out = [];
  const core = byFreq.filter((n) => n.layer === 'core');
  const top = byFreq[0];
  out.push(`${top.number} הוא המספר הדומיננטי ברשת (${top.freq} הופעות).`);
  // מספר עם הכי הרבה קשרים חזקים = "מחבר"
  const memberCount = {};
  for (const p of strongPairs) { memberCount[p.a] = (memberCount[p.a] || 0) + 1; memberCount[p.b] = (memberCount[p.b] || 0) + 1; }
  const connector = Object.entries(memberCount).sort((a, b) => b[1] - a[1])[0];
  if (connector) out.push(`${connector[0]} מחבר בין מרבית האשכולות (${connector[1]} קשרים חזקים).`);
  const highInCore = core.filter((n) => n.number >= 22).length;
  if (highInCore >= 3) out.push(`ריכוז גבוה של מספרים גדולים (≥22) בליבה — ${highInCore} מתוך ${core.length}.`);
  if (byLift[0]) out.push(`הקשר החזק ביותר יחסית לצפוי: ${byLift[0].a}–${byLift[0].b} (lift ${byLift[0].lift}).`);
  out.push('הערה: ברשת אקראית קשרים "חזקים" צפויים להופיע במקרה — אין לכך ערך מנבא.');
  return out;
}

// ----- 10 צירופים מדורגים מבוססי-רשת -----
export function recommendTickets(draws, net, ctx, count = 10) {
  const ctxFilter = { sumMin: ctx.sumMin, sumMax: ctx.sumMax, existingSet: ctx.existingSet };
  const { W, freq } = net;
  const maxFreq = Math.max(...freq.slice(1), 1);
  const maxPair = Math.max(1, ...net.strongPairs.map((p) => p.count));

  function scoreTicket(nums) {
    let conn = 0;
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) conn += W[nums[i]][nums[j]];
    const maxConn = maxPair * (PICK * (PICK - 1) / 2);
    const connScore = conn / (maxConn || 1);            // קישוריות פנימית
    const freqScore = nums.reduce((s, n) => s + freq[n], 0) / (PICK * maxFreq);
    const human = humanLikenessPenalty(nums) / 100;
    return { raw: connScore * 0.6 + freqScore * 0.4 - human * 0.2, connScore, freqScore, conn };
  }

  // יצירת מועמדים תקפים ודירוגם
  const seen = new Set();
  const cands = [];
  for (let t = 0; t < 12000 && cands.length < 600; t++) {
    const nums = randomCombo();
    const k = keyOf(nums);
    if (seen.has(k)) continue; seen.add(k);
    if (!passesFilters(nums, ctxFilter).ok) continue;
    const sc = scoreTicket(nums);
    cands.push({ numbers: nums.sort((a, b) => a - b), ...sc });
  }
  cands.sort((a, b) => b.raw - a.raw);

  const strongOrder = [...ctx.sstats.list].sort((a, b) => b.count - a.count).map((x) => x.number);
  const slice = cands.slice(0, count);
  const maxRaw = slice[0]?.raw ?? 1, minRaw = slice[slice.length - 1]?.raw ?? 0;
  const span = maxRaw - minRaw || 1;
  const tickets = slice.map((c, i) => decorate(c, i, net, ctx, strongOrder, 72 + ((c.raw - minRaw) / span) * 26));

  // 3 מודלים: ליבה טהורה / מעורב / פריפריה טהורה
  const models = {
    core: bestFromPool(net.layers.core.map((n) => n.number), net, ctx, ctxFilter, scoreTicket, strongOrder, 'ליבה טהורה'),
    mixed: bestFromPool(
      [...net.layers.core.slice(0, 4), ...net.layers.bridge.slice(0, 4), ...net.layers.periphery.slice(0, 4)].map((n) => n.number),
      net, ctx, ctxFilter, scoreTicket, strongOrder, 'מעורב (ליבה+גשר+פריפריה)'),
    periphery: bestFromPool(net.layers.periphery.map((n) => n.number), net, ctx, ctxFilter, scoreTicket, strongOrder, 'פריפריה טהורה'),
  };

  return { tickets, models };
}

function decorate(c, i, net, ctx, strongOrder, score) {
  const comp = layerComposition(c.numbers, net.layerOf);
  return {
    rank: i + 1,
    numbers: c.numbers,
    strong: strongOrder[i % strongOrder.length],
    score: Math.round(score * 10) / 10,
    connectivity: Math.round(c.connScore * 1000) / 10,
    composition: comp,
    pattern: patternOf(c.numbers),
  };
}

function layerComposition(nums, layerOf) {
  const c = { core: 0, bridge: 0, periphery: 0 };
  for (const n of nums) c[layerOf[n]]++;
  return c;
}

function bestFromPool(pool, net, ctx, ctxFilter, scoreTicket, strongOrder, label) {
  let basePool = [...new Set(pool)];
  if (basePool.length < PICK) basePool = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);
  let best = null;
  for (let t = 0; t < 4000; t++) {
    const nums = sample(basePool, PICK).sort((a, b) => a - b);
    if (!passesFilters(nums, ctxFilter).ok) continue;
    const sc = scoreTicket(nums);
    if (!best || sc.raw > best.raw) best = { numbers: nums, ...sc };
  }
  if (!best) { const nums = sample(basePool, PICK).sort((a, b) => a - b); best = { numbers: nums, ...scoreTicket(nums) }; }
  return {
    label,
    numbers: best.numbers,
    strong: strongOrder[0],
    score: Math.round(Math.max(0, Math.min(99, 60 + best.raw * 70)) * 10) / 10,
    composition: layerComposition(best.numbers, net.layerOf),
  };
}

function randomCombo() {
  const s = new Set();
  while (s.size < PICK) s.add(1 + Math.floor(Math.random() * MAX_NUMBER));
  return [...s];
}
function sample(arr, k) {
  const a = [...arr]; const o = [];
  for (let i = 0; i < k && a.length; i++) o.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return o;
}
