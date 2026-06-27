import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api.js';
import { Card, Balls, Ball, Loading, ErrorBox, Disclaimer, useApi } from '../components/UI.jsx';

export default function Dashboard() {
  const summary = useApi(() => api.summary());
  const next = useApi(() => api.predictionsNext());
  const perf = useApi(() => api.performance());

  if (summary.loading) return <Loading />;
  if (summary.error) return <ErrorBox error={summary.error} />;
  const s = summary.data;

  const compareData = (perf.data?.models || []).map((m) => ({
    name: modelHe(m.model_name),
    מודל: m.avg_hits,
    אקראי: m.random_avg_hits,
  }));

  return (
    <div>
      <div className="between">
        <h1 className="page-title">דשבורד ראשי</h1>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>© כל הזכויות שמורות — L-E-RAN L.T.D</span>
      </div>
      <p className="page-sub">סקירה כללית · {s.total} הגרלות במאגר</p>

      <div className="grid cols-3">
        <Card title="🎰 הגרלה אחרונה">
          {s.latest ? (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>
                הגרלה #{s.latest.draw_number} · {s.latest.draw_date}
              </div>
              <Balls
                numbers={[s.latest.n1, s.latest.n2, s.latest.n3, s.latest.n4, s.latest.n5, s.latest.n6]}
                strong={s.latest.strong_number}
              />
            </>
          ) : <span className="muted">אין נתונים</span>}
        </Card>

        <Card title="🔮 תחזית להגרלה הבאה" extra={<Link className="tag" to="/predictions">פירוט ›</Link>}>
          {next.data?.predictions?.length ? (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>
                {next.data.predictions[0].label} · הגרלה #{next.data.target_draw_number}
              </div>
              <Balls numbers={next.data.predictions[0].numbers} strong={next.data.predictions[0].strong} />
            </>
          ) : <span className="muted">טוען תחזית...</span>}
        </Card>

        <Card title="📈 ביצועי המודל" extra={<Link className="tag" to="/backtest">Backtest ›</Link>}>
          {perf.data?.models?.length ? (
            <div className="row" style={{ gap: 20 }}>
              <div className="kpi"><span className="v">{perf.data.models[0].avg_hits}</span><span className="l">ממוצע פגיעות (הטוב ביותר)</span></div>
              <div className="kpi"><span className="v">{perf.data.models[0].hit_2_plus}%</span><span className="l">2+ פגיעות</span></div>
            </div>
          ) : <span className="muted">מחשב ביצועים...</span>}
        </Card>
      </div>

      <div className="grid cols-3 section-gap">
        <Card title="🔥 מספרים חמים"><HotList items={s.hot} type="hot" field="last25" suffix="ב-25 אחרונות" /></Card>
        <Card title="❄️ מספרים קרים"><HotList items={s.cold} type="cold" field="last25" suffix="ב-25 אחרונות" /></Card>
        <Card title="⏳ לא הופיעו הרבה זמן"><HotList items={s.overdue} field="drawsSince" suffix="הגרלות מאז" /></Card>
      </div>

      <div className="section-gap">
        <Card title="📊 השוואת ממוצע פגיעות: מודלים מול בחירה אקראית">
          {compareData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={compareData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a0c4', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a0c4', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="מודל" fill="#6c8cff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="אקראי" fill="#46d6a8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <span className="muted">מחשב נתוני השוואה (Backtesting)...</span>}
        </Card>
      </div>

      <Disclaimer />
    </div>
  );
}

function HotList({ items, type, field, suffix }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it) => (
        <div key={it.number} className="row" style={{ justifyContent: 'space-between' }}>
          <Ball n={it.number} type={type} sm />
          <span className="muted" style={{ fontSize: 13 }}>{it[field]} {suffix}</span>
        </div>
      ))}
    </div>
  );
}

export function modelHe(name) {
  return {
    hot_numbers_model: 'חמים',
    cold_numbers_model: 'קרים',
    weighted_model: 'משוקלל',
    pair_model: 'זוגות',
    anti_popularity_model: 'אנטי-פופולרי',
    random_filtered_model: 'אקראי מסונן',
  }[name] || name;
}

const tooltipStyle = { background: '#161e3a', border: '1px solid #26305a', borderRadius: 10, color: '#e8ecf8' };
