import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api.js';
import { Card, Loading, ErrorBox, useApi } from '../components/UI.jsx';

export default function Patterns() {
  const { data, error, loading } = useApi(() => api.patterns());
  const [nums, setNums] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [aErr, setAErr] = useState(null);

  async function analyze() {
    setAErr(null); setAnalysis(null);
    const arr = nums.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= 37);
    if (arr.length !== 6) { setAErr('יש להזין בדיוק 6 מספרים בין 1 ל-37'); return; }
    try { setAnalysis(await api.analyze(arr)); } catch (e) { setAErr(e.message); }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const evenData = Object.entries(data.evenSplit).map(([k, v]) => ({ name: `${k} זוגיים`, count: v }));
  const lowData = Object.entries(data.lowSplit).map(([k, v]) => ({ name: `${k} נמוכים`, count: v }));

  return (
    <div>
      <h1 className="page-title">תבניות</h1>
      <p className="page-sub">ניתוח תבניות מבני של ההגרלות · {data.total} הגרלות</p>

      <div className="grid cols-3">
        <Card title="📐 פיזור זוגי/אי-זוגי">
          <Chart data={evenData} />
        </Card>
        <Card title="⬇️⬆️ נמוכים/גבוהים">
          <Chart data={lowData} />
        </Card>
        <Card title="📊 מדדים כלליים">
          <div className="kpi" style={{ marginBottom: 14 }}><span className="v">{data.sumStats.mean}</span><span className="l">סכום ממוצע (טווח נפוץ {data.sumStats.p10}–{data.sumStats.p90})</span></div>
          <div className="kpi" style={{ marginBottom: 14 }}><span className="v">{data.sequencesPct}%</span><span className="l">הגרלות עם רצף</span></div>
          <div className="kpi"><span className="v">{data.birthdayLikePct}%</span><span className="l">צירופים שנראים מבוססי תאריך לידה</span></div>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="📈 התפלגות סכום המספרים">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.sumHistogram}>
              <XAxis dataKey="bucket" tick={{ fill: '#94a0c4' }} />
              <YAxis tick={{ fill: '#94a0c4' }} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" fill="#6c8cff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="🧮 נתח צירוף משלך">
          <div className="toolbar">
            <input style={{ flex: 1 }} placeholder="הזן 6 מספרים מופרדים ברווח/פסיק, למשל: 3 11 19 24 30 35" value={nums} onChange={(e) => setNums(e.target.value)} />
            <button className="btn" onClick={analyze}>נתח</button>
          </div>
          {aErr && <div className="error">{aErr}</div>}
          {analysis && <PatternResult p={analysis.pattern} nums={analysis.numbers} />}
        </Card>
      </div>
    </div>
  );
}

function PatternResult({ p, nums }) {
  const items = [
    ['מספרים', nums.join(', ')],
    ['זוגיים / אי-זוגיים', `${p.even} / ${p.odd}`],
    ['נמוכים / גבוהים', `${p.low} / ${p.high}`],
    ['סכום', p.sum],
    ['רצפים', p.sequences],
    ['רצף הארוך ביותר', p.maxRun],
    ['פיזור (טווח)', p.spread],
    ['מקסימום מאותו עשור', p.maxSameDecade],
    ['נראה מבוסס תאריך לידה?', p.birthdayLike ? 'כן ⚠️' : 'לא ✓'],
  ];
  return (
    <div className="grid cols-3" style={{ marginTop: 14 }}>
      {items.map(([k, v]) => (
        <div key={k} className="card" style={{ padding: 12 }}>
          <div className="l muted" style={{ fontSize: 12 }}>{k}</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function Chart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis dataKey="name" tick={{ fill: '#94a0c4', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a0c4' }} />
        <Tooltip contentStyle={tip} />
        <Bar dataKey="count" fill="#46d6a8" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const tip = { background: '#161e3a', border: '1px solid #26305a', borderRadius: 10 };
