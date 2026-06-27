import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Card, Balls, Loading, ErrorBox, Disclaimer } from '../components/UI.jsx';

export default function Tools() {
  const [count, setCount] = useState(8);
  const [poolText, setPoolText] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const pool = poolText.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= 37);
      setData(await api.wheel(Number(count), pool.length >= 6 ? pool : null));
    } catch (e) { setError(e); } finally { setLoading(false); }
  }

  function exportTickets() {
    if (!data) return;
    const lines = data.tickets.map((t, i) => `טור ${i + 1}: ${t.numbers.join(', ')} | חזק: ${t.strong}`);
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lotto_tickets.txt'; a.click();
  }

  return (
    <div>
      <h1 className="page-title">מחולל טורים (Wheeling)</h1>
      <p className="page-sub">מייצר טורים מגוונים שממקסמים כיסוי ופיזור — לשיפור הכיסוי בלבד, לא הסיכוי.</p>

      <div className="toolbar">
        <label className="muted">מספר טורים:</label>
        <input type="number" min="1" max="50" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: 80 }} />
        <input style={{ flex: 1, minWidth: 200 }} placeholder="בריכת מספרים אופציונלית (ריק = 16 המובילים), למשל: 3 7 11 19 24 30 35" value={poolText} onChange={(e) => setPoolText(e.target.value)} />
        <button className="btn" onClick={generate} disabled={loading}>{loading ? 'מחשב...' : '🎟️ צור טורים'}</button>
        {data && <button className="btn ghost" onClick={exportTickets}>⬇️ ייצוא</button>}
      </div>

      {error && <ErrorBox error={error} />}
      {loading && <Loading />}

      {data && !loading && (
        <>
          <div className="grid cols-4">
            <Card title="כיסוי מספרים"><Kpi v={`${data.coverage.numbersCovered}/${data.coverage.numbersTotal}`} /></Card>
            <Card title="כיסוי זוגות"><Kpi v={`${data.coverage.pairCoveragePct}%`} sub={`${data.coverage.pairsCovered} זוגות`} /></Card>
            <Card title="עלות כוללת"><Kpi v={`₪${data.economics.totalCost}`} sub={`₪${data.economics.pricePerLine} לטור`} /></Card>
            <Card title="סיכוי לג'קפוט"><Kpi v={`1 ל-${data.economics.jackpotOddsOneIn.toLocaleString('en-US')}`} sub="לכל טור" /></Card>
          </div>

          <div className="section-gap grid cols-2">
            {data.tickets.map((t, i) => (
              <Card key={i} title={`טור ${i + 1}`}>
                <Balls numbers={t.numbers} strong={t.strong} />
              </Card>
            ))}
          </div>

          <div className="disclaimer neutral section-gap">🎲 <span>{data.economics.note}</span></div>
        </>
      )}

      <Disclaimer />
    </div>
  );
}

function Kpi({ v, sub }) {
  return (
    <div>
      <div className="stat-big">{v}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}
