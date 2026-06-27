import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api.js';
import { Card, Ball, Loading, ErrorBox, Disclaimer, useApi } from '../components/UI.jsx';

export default function Strong() {
  const { data, error, loading } = useApi(() => api.strong());
  const next = useApi(() => api.predictionsNext());
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const chart = data.list.map((x) => ({ name: String(x.number), הופעות: x.count, hot: data.hot.includes(x.number), cold: data.cold.includes(x.number) }));
  const predStrong = next.data?.predictions?.[0]?.strong;

  return (
    <div>
      <h1 className="page-title">מספר חזק</h1>
      <p className="page-sub">ניתוח המספר החזק (1–7)</p>

      <div className="grid cols-4">
        <Card title="🔥 חזק חם">
          <div className="row">{data.hot.map((n) => <Ball key={n} n={n} type="hot" />)}</div>
          <div className="hint" style={{ marginTop: 8 }}>הופיעו הכי הרבה</div>
        </Card>
        <Card title="❄️ חזק קר">
          <div className="row">{data.cold.map((n) => <Ball key={n} n={n} type="cold" />)}</div>
          <div className="hint" style={{ marginTop: 8 }}>הופיעו הכי מעט</div>
        </Card>
        <Card title="🔮 תחזית למספר חזק הבא">
          {predStrong != null ? <Ball n={predStrong} type="strong" /> : <span className="muted">טוען...</span>}
          <div className="hint" style={{ marginTop: 8 }}>לפי המודל המשוקלל</div>
        </Card>
        <Card title="📊 סיכום">
          <div className="kpi"><span className="v">7</span><span className="l">טווח מספרים אפשריים</span></div>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="📈 תדירות מספרים חזקים">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#94a0c4' }} />
              <YAxis tick={{ fill: '#94a0c4' }} />
              <Tooltip contentStyle={{ background: '#161e3a', border: '1px solid #26305a', borderRadius: 10 }} />
              <Bar dataKey="הופעות" radius={[6, 6, 0, 0]}>
                {chart.map((c, i) => <Cell key={i} fill={c.hot ? '#ff6b6b' : c.cold ? '#5bc0eb' : '#6c8cff'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="טבלת מספרים חזקים">
          <div className="table-wrap">
            <table>
              <thead><tr><th>מספר</th><th>הופעות</th><th>אחוז</th><th>הופעה אחרונה</th><th>הגרלות מאז</th></tr></thead>
              <tbody>
                {data.list.map((x) => (
                  <tr key={x.number}>
                    <td><Ball n={x.number} type="strong" sm /></td>
                    <td>{x.count}</td><td>{x.pct}%</td>
                    <td className="muted">{x.lastDate || '—'}</td><td>{x.drawsSince}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}
