import React, { useState, useMemo } from 'react';
import { api } from '../lib/api.js';
import { Loading, ErrorBox, useApi } from '../components/UI.jsx';

const NUMS = Array.from({ length: 37 }, (_, i) => i + 1);
const OPTIONS = [25, 50, 100, 200, 500, 1000];

export default function Grid() {
  const [limit, setLimit] = useState(50);
  const { data, error, loading } = useApi(() => api.draws({ limit }), [limit]);

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
    </div>
  );
}
