import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Balls, Loading, ErrorBox, Disclaimer, SignificanceNote, useApi } from '../components/UI.jsx';
import { modelHe } from './Dashboard.jsx';

export default function Predictions() {
  const { data, error, loading, setData } = useApi(() => api.predictionsNext());
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setBusy(true);
    try { setData(await api.generate()); } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading text="מחשב תחזיות..." />;
  if (error) return <ErrorBox error={error} />;
  const preds = data.predictions || [];

  return (
    <div>
      <div className="between">
        <div>
          <h1 className="page-title">תחזית להגרלה הבאה</h1>
          <p className="page-sub">הגרלה #{data.target_draw_number} · 3 תחזיות לפי מודלים שונים</p>
        </div>
        <button className="btn" onClick={regenerate} disabled={busy}>{busy ? 'מחשב...' : '🔄 חשב מחדש'}</button>
      </div>

      <Disclaimer />

      <div className="grid cols-3 section-gap">
        {preds.map((p, i) => (
          <PredCard key={p.id || i} p={p} kind={i === 0 ? 'main' : i === 2 ? 'aggressive' : ''} />
        ))}
      </div>
    </div>
  );
}

function PredCard({ p, kind }) {
  const perf = p.performance;
  return (
    <div className={`card pred-card ${kind}`}>
      <div className="label">{p.label} · מודל {modelHe(p.model_name)}</div>
      <Balls numbers={p.numbers} strong={p.strong} />
      <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        {p.backtestAvg != null
          ? <span className="tag">ממוצע פגיעות (Backtest): {p.backtestAvg}</span>
          : <span className="tag">ציון פנימי לדירוג: {p.score}</span>}
        {p.pattern && <span className="tag">סכום: {p.pattern.sum}</span>}
        <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => copyTicket(p)}>📋 העתק</button>
      </div>

      <h3 style={{ marginTop: 18, fontSize: 14 }}>נימוק לכל מספר</h3>
      <ul className="explain-list">
        {(p.perNumber || []).map((e) => (
          <li key={e.number}>
            <b style={{ minWidth: 26 }}>{e.number}:</b>
            <span>{e.reasons.join(' · ')}</span>
          </li>
        ))}
      </ul>

      <h3 style={{ marginTop: 18, fontSize: 14 }}>אחוזי פגיעה היסטוריים (Backtesting)</h3>
      {perf ? (
        <div className="grid cols-2" style={{ gap: 8 }}>
          <Kpi v={perf.avg_hits} l="ממוצע פגיעות" sub={`אקראי: ${perf.random_avg_hits}`} />
          <Kpi v={perf.hit_1_plus + '%'} l="לפחות פגיעה אחת" />
          <Kpi v={perf.hit_2_plus + '%'} l="לפחות 2 פגיעות" />
          <Kpi v={perf.hit_3_plus + '%'} l="לפחות 3 פגיעות" />
          <Kpi v={perf.strong_hit_rate + '%'} l="פגיעה במספר חזק" />
          <Kpi v={(perf.improvement_vs_random >= 0 ? '+' : '') + perf.improvement_vs_random} l="שיפור מול אקראי" />
        </div>
      ) : <span className="muted hint">ביצועים מתחשבים ברקע — רעננו בעוד רגע.</span>}

      <SignificanceNote significant={p.significant} verdict={p.verdict} />

      <div className="disclaimer" style={{ marginTop: 14, fontSize: 12 }}>
        ⚠️ אין הבטחת זכייה. נתוני עבר אינם מנבאים תוצאות עתידיות.
      </div>
    </div>
  );
}

function copyTicket(p) {
  const txt = `${p.label}: ${p.numbers.join(', ')} | חזק: ${p.strong}`;
  navigator.clipboard?.writeText(txt);
}

function Kpi({ v, l, sub }) {
  return (
    <div className="card" style={{ padding: 10 }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
      <div className="muted" style={{ fontSize: 11 }}>{l}</div>
      {sub && <div className="muted" style={{ fontSize: 10 }}>{sub}</div>}
    </div>
  );
}
