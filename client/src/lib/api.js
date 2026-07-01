const BASE = '/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error; } catch {}
    throw new Error(detail || `שגיאה ${res.status}`);
  }
  return res.json();
}

export const api = {
  draws: (params = {}) => req('/draws?' + new URLSearchParams(params)),
  latest: () => req('/draws/latest'),
  sync: () => req('/draws/sync', { method: 'POST' }),
  numbers: () => req('/stats/numbers'),
  strong: () => req('/stats/strong'),
  pairs: (limit = 30) => req('/stats/pairs?limit=' + limit),
  triples: (limit = 20) => req('/stats/triples?limit=' + limit),
  summary: () => req('/stats/summary'),
  patterns: () => req('/stats/patterns'),
  randomness: () => req('/stats/randomness'),
  intervals: () => req('/stats/intervals'),
  analyze: (numbers) => req('/stats/analyze', { method: 'POST', body: JSON.stringify({ numbers }) }),
  wheel: (count, pool) => req('/tools/wheel', { method: 'POST', body: JSON.stringify({ count, pool }) }),
  network: (count = 10) => req('/network?count=' + count),
  importCsv: (csv) => req('/draws/import', { method: 'POST', body: JSON.stringify({ csv }) }),
  predictionsNext: () => req('/predictions/next'),
  generate: () => req('/predictions/generate', { method: 'POST' }),
  performance: () => req('/models/performance'),
  backtest: (body) => req('/backtest/run', { method: 'POST', body: JSON.stringify(body || {}) }),
};

export function downloadCSV(draws) {
  const header = ['draw_number', 'draw_date', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'strong_number'];
  const rows = draws.map((d) => header.map((h) => d[h]).join(','));
  const csv = '﻿' + header.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lotto_draws.csv';
  a.click();
  URL.revokeObjectURL(url);
}
