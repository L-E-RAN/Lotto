import React from 'react';
import { api } from '../lib/api.js';
import { Card, Loading, ErrorBox, useApi } from '../components/UI.jsx';

export default function Randomness() {
  const { data, error, loading } = useApi(() => api.randomness());
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div>
      <h1 className="page-title">מבחני אקראיות</h1>
      <p className="page-sub">מבחן חי-בריבוע (Chi-square) לטיב-התאמה לאחידות · {data.total} הגרלות</p>

      <div className="disclaimer neutral">🔬 <span>{data.note}</span></div>

      <div className="grid cols-2 section-gap">
        <TestCard title="התפלגות 37 המספרים" t={data.numbers} />
        <TestCard title="התפלגות המספר החזק (1–7)" t={data.strong} />
      </div>

      <Card title="איך לקרוא את זה?" className="section-gap">
        <ul className="explain-list">
          <li><b>chi² ו-df:</b> ככל ש-chi² גבוה יותר ביחס לדרגות החופש (df), הסטייה מאחידות גדולה יותר.</li>
          <li><b>p-value:</b> ההסתברות לקבל סטייה כזו (או גדולה יותר) במקרה, אם ההגרלה הוגנת לחלוטין.</li>
          <li><b>p ≥ 0.05:</b> אין עדות סטטיסטית להטיה — "חם" ו"קר" הם תנודות אקראיות, לא תכונה אמיתית של מספר.</li>
          <li><b>p &lt; 0.05:</b> סטייה מובהקת — בדרך כלל מעיד על בעיה בנתונים, לא על מספר "מזל".</li>
        </ul>
      </Card>
    </div>
  );
}

function TestCard({ title, t }) {
  return (
    <Card title={title}>
      <div className="grid cols-2" style={{ gap: 10 }}>
        <Metric l="chi²" v={t.chi2} />
        <Metric l="דרגות חופש" v={t.df} />
        <Metric l="p-value" v={t.pValue} />
        <Metric l="צפי לקטגוריה" v={t.expected} />
      </div>
      <div className={`disclaimer ${t.significant ? '' : 'neutral'}`} style={{ marginTop: 14, fontSize: 13 }}>
        {t.significant ? '⚠️' : '✓'} <span>{t.verdict}</span>
      </div>
    </Card>
  );
}

function Metric({ l, v }) {
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="muted" style={{ fontSize: 12 }}>{l}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
    </div>
  );
}
