import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Card, Balls, Ball, Loading, ErrorBox, Disclaimer } from '../components/UI.jsx';

const TAG_COLOR = {
  'חם': '#ff6b6b', 'מאחר': '#ffcb47', 'מגמה עולה': '#46d6a8',
  'ליבה': '#e0473b', 'גשר': '#e0941a', 'פריפריה': '#4f7fd6', 'מעל 31': '#9fb0ff',
};

export default function Tools() {
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState('insights');
  const [poolText, setPoolText] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const pool = poolText.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= 37);
      setData(await api.wheel(Number(count), pool.length >= 6 ? pool : null, mode));
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
      <h1 className="page-title">מחולל טורים חכם</h1>
      <p className="page-sub">מסנתז את כל התובנות באתר (חזרתיות, פרופיל, מספר חזק, מפת קשרים, מגמות) לטורים מאוזנים ומנומקים.</p>

      <div className="toolbar">
        <label className="muted">מצב:</label>
        <button className={`btn ${mode === 'insights' ? '' : 'ghost'}`} onClick={() => setMode('insights')}>לפי תובנות</button>
        <button className={`btn ${mode === 'coverage' ? '' : 'ghost'}`} onClick={() => setMode('coverage')}>כיסוי מרבי</button>
        <label className="muted" style={{ marginInlineStart: 10 }}>טורים:</label>
        <input type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: 70 }} />
        <button className="btn" onClick={generate} disabled={loading}>{loading ? 'מחשב...' : '🎟️ צור טורים'}</button>
        {data && <button className="btn ghost" onClick={exportTickets}>⬇️ ייצוא</button>}
      </div>
      {mode === 'coverage' && (
        <div className="toolbar">
          <input style={{ flex: 1, minWidth: 200 }} placeholder="בריכת מספרים אופציונלית (ריק = 16 המובילים)" value={poolText} onChange={(e) => setPoolText(e.target.value)} />
        </div>
      )}

      {error && <ErrorBox error={error} />}
      {loading && <Loading />}

      {data && !loading && data.mode === 'insights' && <InsightView data={data} />}
      {data && !loading && data.mode === 'coverage' && <CoverageView data={data} />}

      <Disclaimer />
    </div>
  );
}

function InsightView({ data }) {
  return (
    <>
      <div className="grid cols-2 section-gap">
        <Card title="💡 התובנות שהוזנו למחולל">
          <ul className="explain-list">{data.topInsights.map((s, i) => <li key={i}>• <span>{s}</span></li>)}</ul>
        </Card>
        <Card title="⚖️ משקלי התובנות">
          {Object.entries({ freq: 'תדירות', recent: 'עדכניות (חם)', due: 'מאחר (מרווח)', layer: 'מרכזיות ברשת', trend: 'מגמה' }).map(([k, label]) => (
            <div key={k} className="between" style={{ marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>{label}</span>
              <span style={{ fontWeight: 700 }}>{Math.round(data.weights[k] * 100)}%</span>
            </div>
          ))}
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
            {data.ranked.slice(0, 10).map((n) => <Ball key={n.number} n={n.number} sm />)}
            <span className="hint" style={{ width: '100%' }}>10 המספרים המובילים לפי ציון התובנות המשוקלל</span>
          </div>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="🎟️ טורים מדורגים ומנומקים">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.tickets.map((t) => (
              <div key={t.rank} className="card" style={{ padding: 14 }}>
                <div className="between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="tag" style={{ fontWeight: 800 }}>#{t.rank}</span>
                    <Balls numbers={t.numbers} strong={t.strong} sm />
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="tag">ציון {t.score}</span>
                    <span className="tag">קישוריות {t.connectivity}%</span>
                    <span className="tag">סכום {t.pattern.sum}</span>
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {t.reasons.map((r) => (
                    <span key={r.number} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', fontSize: 11 }}>
                      <b>{r.number}</b>
                      {r.tags.map((tg) => <span key={tg} style={{ color: TAG_COLOR[tg] || 'var(--muted)' }}>{tg}</span>)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Econ e={data.economics} />
    </>
  );
}

function CoverageView({ data }) {
  return (
    <>
      <div className="grid cols-4 section-gap">
        <Kpi t="כיסוי מספרים" v={`${data.coverage.numbersCovered}/${data.coverage.numbersTotal}`} />
        <Kpi t="כיסוי זוגות" v={`${data.coverage.pairCoveragePct}%`} />
        <Kpi t="עלות כוללת" v={`₪${data.economics.totalCost}`} />
        <Kpi t="סיכוי לג'קפוט" v={`1 ל-${data.economics.jackpotOddsOneIn.toLocaleString('en-US')}`} />
      </div>
      <div className="section-gap grid cols-2">
        {data.tickets.map((t, i) => <Card key={i} title={`טור ${i + 1}`}><Balls numbers={t.numbers} strong={t.strong} sm /></Card>)}
      </div>
      <Econ e={data.economics} />
    </>
  );
}

function Econ({ e }) {
  return (
    <div className="grid cols-4 section-gap">
      <Kpi t="טורים" v={e.lines} />
      <Kpi t="עלות כוללת" v={`₪${e.totalCost}`} sub={`₪${e.pricePerLine} לטור`} />
      <Kpi t="סיכוי לג'קפוט (לטור)" v={`1 ל-${e.jackpotOddsOneIn.toLocaleString('en-US')}`} />
      <div className="card"><div className="hint">{e.note}</div></div>
    </div>
  );
}
function Kpi({ t, v, sub }) {
  return <div className="card"><div className="muted" style={{ fontSize: 12 }}>{t}</div><div className="stat-big">{v}</div>{sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}</div>;
}
