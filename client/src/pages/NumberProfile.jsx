import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { api } from '../lib/api.js';
import { Card, Ball, Loading, ErrorBox, useApi } from '../components/UI.jsx';

const NUMS = Array.from({ length: 37 }, (_, i) => i + 1);
const tip = { background: '#161e3a', border: '1px solid #26305a', borderRadius: 10 };

export default function NumberProfile() {
  const [n, setN] = useState(12);
  const { data, error, loading } = useApi(() => api.numberProfile(n), [n]);

  return (
    <div>
      <h1 className="page-title">פרופיל מספר — חיפוש תבניות</h1>
      <p className="page-sub">בחר מספר וקבל את כל הדפוסים שלו: מרווחים, ימים, שותפים, רצפים, "יד חמה" ומגמה.</p>

      <Card title="בחר מספר">
        <div className="balls" style={{ gap: 6 }}>
          {NUMS.map((x) => (
            <button key={x} onClick={() => setN(x)} className="ballbtn"
              style={{
                width: 38, height: 38, borderRadius: '50%', border: x === n ? '2px solid #6c8cff' : '1px solid #3a477f',
                background: x === n ? 'linear-gradient(160deg,#4ea8ff,#1f6fe0)' : 'linear-gradient(160deg,#34407a,#222d57)',
                color: '#fff', fontWeight: 800, cursor: 'pointer',
              }}>{x}</button>
          ))}
        </div>
      </Card>

      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : <Profile p={data.profile} />}
    </div>
  );
}

function Profile({ p }) {
  const wdData = p.weekday.map((w) => ({ name: w.day, שיעור: w.rate, draws: w.draws, vsBase: w.vsBase }));
  const maxWd = Math.max(...wdData.map((w) => w.שיעור), 1);
  return (
    <>
      <div className="grid cols-4 section-gap">
        <Kpi v={`${p.count}`} l={`הופעות (${p.pct}%)`} />
        <Kpi v={`פעם ב-${p.avgGap}`} l={`חציון ${p.medianGap} · שכיח ${p.modeGap}`} />
        <Kpi v={p.currentGap} l="הגרלות מאז הופעה אחרונה" />
        <Kpi v={`${p.maxStreak} / ${p.maxDrought}`} l="רצף מקס / בצורת מקס" />
      </div>

      <div className="grid cols-2 section-gap">
        <Card title="📊 התפלגות מרווחים (כל כמה הגרלות יצא)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={p.histogram}>
              <XAxis dataKey="gap" tick={{ fill: '#94a0c4', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a0c4' }} />
              <Tooltip contentStyle={tip} formatter={(v) => [v, 'פעמים']} labelFormatter={(l) => `מרווח ${l} הגרלות`} />
              <ReferenceLine x={Math.round(p.avgGap)} stroke="#ffcb47" strokeDasharray="4 4" label={{ value: 'ממוצע', fill: '#ffcb47', fontSize: 11 }} />
              <Bar dataKey="count" fill="#6c8cff" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="hint">שכיח = מרווח {p.modeGap} · ממוצע {p.avgGap} · חציון {p.medianGap}. זנב ארוך = בצורות אקראיות שמושכות את הממוצע למעלה.</div>
        </Card>

        <Card title="📅 נטייה לפי יום בשבוע">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wdData}>
              <XAxis dataKey="name" tick={{ fill: '#94a0c4', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a0c4' }} />
              <Tooltip contentStyle={tip} formatter={(v, k, o) => [`${v}% (מתוך ${o.payload.draws} הגרלות)`, 'שיעור']} />
              <Bar dataKey="שיעור" radius={[5, 5, 0, 0]}>
                {wdData.map((w, i) => <Cell key={i} fill={w.draws < 30 ? '#5a6b95' : w.שיעור > (p.recent.lifetime) ? '#46d6a8' : '#6c8cff'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="hint">קו הבסיס: {p.recent.lifetime}%. ימים אפורים = מעט הגרלות (מדגם קטן, לא אמין).</div>
        </Card>
      </div>

      <div className="grid cols-3 section-gap">
        <Card title="🤝 שותפים נפוצים (קו-הופעה)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.companions.map((c) => (
              <div key={c.number} className="row" style={{ justifyContent: 'space-between' }}>
                <Ball n={c.number} sm />
                <span className="muted">{c.count}× · lift {c.lift}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="🔥 יד חמה?">
          <div className="kpi" style={{ marginBottom: 12 }}><span className="v">{p.hotHand.followRate}%</span><span className="l">מופיע גם בהגרלה הבאה</span></div>
          <div className="kpi" style={{ marginBottom: 12 }}><span className="v">{p.hotHand.baseRate}%</span><span className="l">קצב בסיס (רגיל)</span></div>
          <div className={`badge ${Math.abs(p.hotHand.lift - 1) < 0.1 ? 'flat' : p.hotHand.lift > 1 ? 'up' : 'down'}`}>
            lift {p.hotHand.lift} — {Math.abs(p.hotHand.lift - 1) < 0.1 ? 'אין אפקט (אקראי)' : p.hotHand.lift > 1 ? 'נטייה קלה לחזור' : 'נטייה קלה להיעדר'}
          </div>
        </Card>

        <Card title="📈 מגמה אחרונה">
          <Row l="ב-25 אחרונות" v={`${p.recent.last25}%`} />
          <Row l="ב-50 אחרונות" v={`${p.recent.last50}%`} />
          <Row l="ב-100 אחרונות" v={`${p.recent.last100}%`} />
          <Row l="לכל ההיסטוריה" v={`${p.recent.lifetime}%`} bold />
          <div className="hint" style={{ marginTop: 8 }}>
            {p.recent.last50 > p.recent.lifetime ? 'חם לאחרונה מהממוצע' : p.recent.last50 < p.recent.lifetime ? 'קר לאחרונה מהממוצע' : 'כמו הממוצע'}
          </div>
        </Card>
      </div>

      <div className="disclaimer neutral section-gap">
        🎲 <span>כל ה"דפוסים" כאן מתארים עבר בלבד. ערכי lift ≈ 1 ושונות המרווחים גבוהה — כלומר עקבי עם אקראיות. אין לכך ערך מנבא.</span>
      </div>
    </>
  );
}

function Kpi({ v, l }) {
  return <div className="card"><div className="stat-big">{v}</div><div className="muted" style={{ fontSize: 12 }}>{l}</div></div>;
}
function Row({ l, v, bold }) {
  return <div className="between" style={{ marginBottom: 8 }}><span className="muted" style={{ fontSize: 13 }}>{l}</span><span style={{ fontWeight: bold ? 800 : 600 }}>{v}</span></div>;
}
