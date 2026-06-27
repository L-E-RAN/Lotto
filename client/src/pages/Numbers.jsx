import React, { useState, useMemo } from 'react';
import { api } from '../lib/api.js';
import { Ball, Trend, Loading, ErrorBox, useApi } from '../components/UI.jsx';

export default function Numbers() {
  const { data, error, loading } = useApi(() => api.numbers());
  const rnd = useApi(() => api.randomness());
  const [sort, setSort] = useState('number');
  const [dir, setDir] = useState('asc');

  const rows = useMemo(() => {
    if (!data) return [];
    const arr = [...data.numbers].sort((a, b) => {
      const v = (a[sort] ?? 0) - (b[sort] ?? 0);
      return dir === 'asc' ? v : -v;
    });
    return arr;
  }, [data, sort, dir]);

  function header(label, key) {
    const active = sort === key;
    return (
      <th style={{ cursor: 'pointer' }} onClick={() => {
        if (active) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSort(key); setDir('desc'); }
      }}>
        {label} {active ? (dir === 'asc' ? '▲' : '▼') : ''}
      </th>
    );
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div>
      <h1 className="page-title">סטטיסטיקת מספרים</h1>
      <p className="page-sub">לחיצה על כותרת ממיינת · מבוסס על {data.total} הגרלות</p>
      {rnd.data && (
        <div className={`disclaimer ${rnd.data.numbers.significant ? '' : 'neutral'}`} style={{ marginBottom: 16, fontSize: 13 }}>
          {rnd.data.numbers.significant ? '⚠️' : '🔬'} <span>{rnd.data.numbers.verdict} (Chi²={rnd.data.numbers.chi2}, p={rnd.data.numbers.pValue})</span>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {header('מספר', 'number')}
              {header('הופעות', 'count')}
              {header('אחוז', 'pct')}
              <th>רווח סמך 95%</th>
              <th>הופעה אחרונה</th>
              {header('הגרלות מאז', 'drawsSince')}
              {header('ב-10', 'last10')}
              {header('ב-25', 'last25')}
              {header('ב-50', 'last50')}
              {header('ב-100', 'last100')}
              <th>מגמה</th>
              {header('ציון', 'score')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.number}>
                <td><Ball n={r.number} sm /></td>
                <td>{r.count}</td>
                <td>{r.pct}%</td>
                <td className="muted" style={{ direction: 'ltr', textAlign: 'right' }}>{r.ciLow}–{r.ciHigh}% <span style={{ fontSize: 11 }}>(±{r.ciMargin})</span></td>
                <td className="muted">{r.lastDate || '—'}</td>
                <td>{r.drawsSince}</td>
                <td>{r.last10}</td>
                <td>{r.last25}</td>
                <td>{r.last50}</td>
                <td>{r.last100}</td>
                <td><Trend trend={r.trend} /></td>
                <td><b>{r.score}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
