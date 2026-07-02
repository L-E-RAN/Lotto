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
          <p className="page-sub">הגרלה #{data.target_draw_number} · {preds.length} תחזיות לפי אסטרטגיות שונות</p>
        </div>
        <button className="btn" onClick={regenerate} disabled={busy}>{busy ? 'מחשב...' : '🔄 חשב מחדש'}</button>
      </div>

      <Disclaimer />

      <div className="grid cols-3 section-gap">
        {preds.map((p, i) => (
          <PredCard key={p.id || i} p={p} kind={p.confidence ? 'main' : p.model_name === 'anti_popularity_model' ? 'aggressive' : ''} />
        ))}
      </div>
    </div>
  );
}

function PredCard({ p, kind }) {
  const perf = p.performance;
  const conf = p.confidence;
  return (
    <div className={`card pred-card ${kind}`}>
      <div className="label">{p.label}{!conf && ` · מודל ${modelHe(p.model_name)}`}</div>
      <Balls numbers={p.numbers} strong={p.strong} />
      <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        {conf
          ? <span className="tag" style={{ color: 'var(--accent-2)' }}>{conf.above50}/6 מספרים מעל 50%</span>
          : p.backtestAvg != null
            ? <span className="tag">ממוצע פגיעות (Backtest): {p.backtestAvg}</span>
            : <span className="tag">ציון פנימי לדירוג: {p.score}</span>}
        {p.pattern && <span className="tag">סכום: {p.pattern.sum}</span>}
        <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => copyTicket(p)}>📋 העתק</button>
      </div>

      {conf && (
        <>
          <h3 style={{ marginTop: 18, fontSize: 14 }}>הסתברות הופעה תוך {conf.withinK} הגרלות</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conf.perNumberProb.map((x) => (
              <div key={x.number} className="row" style={{ gap: 8 }}>
                <b style={{ minWidth: 24 }}>{x.number}</b>
                <div className="ci-bar" style={{ flex: 1 }}>
                  <i style={{ width: Math.min(100, x.prob) + '%', background: x.prob > 50 ? 'linear-gradient(90deg,#46d6a8,#2bb98c)' : 'linear-gradient(90deg,#ffcb47,#e09b1a)' }} />
                </div>
                <span style={{ minWidth: 46, textAlign: 'left', fontWeight: 700, color: x.prob > 50 ? 'var(--accent-2)' : 'var(--warn)' }}>{x.prob}%</span>
              </div>
            ))}
          </div>
          <div className="disclaimer neutral" style={{ marginTop: 12, fontSize: 12 }}>ℹ️ <span>{conf.note}</span></div>
          <div className="disclaimer" style={{ marginTop: 10, fontSize: 12 }}>⚠️ אין הבטחת זכייה. נתוני עבר אינם מנבאים תוצאות עתידיות.</div>
        </>
      )}

      {!conf && <>
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
      </>}
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
