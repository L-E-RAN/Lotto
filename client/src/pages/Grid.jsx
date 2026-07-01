import React, { useState, useMemo } from 'react';
import { api } from '../lib/api.js';
import { Card, Ball, Loading, ErrorBox, useApi } from '../components/UI.jsx';

const NUMS = Array.from({ length: 37 }, (_, i) => i + 1);
const OPTIONS = [25, 50, 100, 200, 500, 1000];

export default function Grid() {
  const [limit, setLimit] = useState(50);
  const { data, error, loading } = useApi(() => api.draws({ limit }), [limit]);
  const iv = useApi(() => api.intervals());

  // ספירת הופעות לכל מספר בחלון המוצג (לשורת הסיכום)
  const colTotals = useMemo(() => {
    const t = new Array(38).fill(0);
    for (const d of (data?.draws || [])) for (const n of [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]) t[n]++;
    return t;
  }, [data]);
  const maxCol = Math.max(...colTotals.slice(1), 1);

  return (
    <div>
      <h1 className="page-title">חזרתיות מספרים</h1>
      <p className="page-sub">כל הגרלה בשורה · תא צבוע = המספר יצא באותה הגרלה · המספר החזק מסומן בטבעת</p>

      <div className="toolbar">
        <label className="muted">כמות הגרלות להצגה:</label>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          {OPTIONS.map((o) => <option key={o} value={o}>{o} אחרונות</option>)}
        </select>
        {data && <span className="tag">מוצג {Math.min(limit, data.total)} מתוך {data.total}</span>}
        <div className="row" style={{ gap: 14, marginInlineStart: 'auto' }}>
          <span className="row" style={{ gap: 6 }}><i className="gcell on" /> יצא</span>
          <span className="row" style={{ gap: 6 }}><i className="gcell strong" /> מספר חזק</span>
        </div>
      </div>

      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="grid-wrap">
          <table className="recur">
            <thead>
              <tr>
                <th className="stick-c">הגרלה</th>
                <th className="stick-c2">תאריך</th>
                {NUMS.map((n) => <th key={n} className="numh">{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.draws.map((d) => {
                const set = new Set([d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]);
                return (
                  <tr key={d.id}>
                    <td className="stick-c mono">#{d.draw_number}</td>
                    <td className="stick-c2 muted">{d.draw_date}</td>
                    {NUMS.map((n) => {
                      const on = set.has(n);
                      const strong = d.strong_number === n;
                      return <td key={n} className={`gc ${on ? 'on' : ''} ${strong ? 'strong' : ''}`}>{on ? n : ''}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="stick-c" colSpan={2}>סה"כ בחלון</td>
                {NUMS.map((n) => {
                  const t = colTotals[n];
                  const heat = t / maxCol;
                  return (
                    <td key={n} className="tot" style={{ background: `rgba(108,140,255,${0.08 + heat * 0.8})` }} title={`${n}: ${t} הופעות`}>{t}</td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Recurrence iv={iv} />
    </div>
  );
}

function Recurrence({ iv }) {
  const [sort, setSort] = useState('number');
  if (iv.loading) return <div className="section-gap"><Loading text="מחשב דפוסי חזרתיות..." /></div>;
  if (iv.error || !iv.data) return null;
  const rows = [...iv.data.intervals].sort((a, b) =>
    sort === 'avg' ? a.avgGap - b.avgGap : sort === 'reg' ? a.cv - b.cv : sort === 'due' ? b.currentGap - a.currentGap : a.number - b.number);
  const regClass = (r) => (r === 'סדיר' ? 'up' : r === 'בינוני' ? 'flat' : 'down');

  return (
    <div className="section-gap">
      <Card title="🔁 דפוס חזרתיות לכל מספר">
        <div className="disclaimer neutral" style={{ marginBottom: 14, fontSize: 13 }}>
          🎲 <span>{iv.data.note} בפועל כמעט כל המספרים "אקראיים" — יוצאים בממוצע פעם ב-~6 הגרלות, ללא מרווח קבוע.</span>
        </div>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="muted">מיון:</span>
          <button className={`btn ${sort === 'number' ? '' : 'ghost'}`} onClick={() => setSort('number')}>לפי מספר</button>
          <button className={`btn ${sort === 'avg' ? '' : 'ghost'}`} onClick={() => setSort('avg')}>מרווח ממוצע</button>
          <button className={`btn ${sort === 'reg' ? '' : 'ghost'}`} onClick={() => setSort('reg')}>סדירות</button>
          <button className={`btn ${sort === 'due' ? '' : 'ghost'}`} onClick={() => setSort('due')}>הכי מאחר</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>מספר</th><th>פעם ב־ (ממוצע)</th><th>חציון</th><th>מינ׳–מקס׳</th>
                <th>סדירות (CV)</th><th>הגרלות מאז</th><th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.number}>
                  <td><Ball n={r.number} sm /></td>
                  <td><b>{r.avgGap}</b> הגרלות</td>
                  <td className="muted">{r.medianGap}</td>
                  <td className="muted">{r.minGap}–{r.maxGap}</td>
                  <td><span className={`badge ${regClass(r.regularity)}`}>{r.regularity} · {r.cv}</span></td>
                  <td>{r.currentGap}</td>
                  <td>{r.due ? <span className="badge down">⏰ מאחר</span> : <span className="badge up">בזמן</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
