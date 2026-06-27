import React, { useMemo } from 'react';
import { api } from '../lib/api.js';
import { Card, Ball, Loading, ErrorBox, useApi } from '../components/UI.jsx';
import { MAX_NUMBER } from '../lib/consts.js';

export default function Pairs() {
  const pairs = useApi(() => api.pairs(40));
  const triples = useApi(() => api.triples(20));
  if (pairs.loading || triples.loading) return <Loading />;
  if (pairs.error) return <ErrorBox error={pairs.error} />;

  return (
    <div>
      <h1 className="page-title">זוגות ושלשות</h1>
      <p className="page-sub">ניתוח צירופים של 2 ו-3 מספרים</p>

      <div className="grid cols-2">
        <Card title="🔗 זוגות נפוצים">
          <PairTable rows={pairs.data.common} field="count" label="הופעות" />
        </Card>
        <Card title="⏳ זוגות שלא הופיעו הרבה זמן">
          <PairTable rows={pairs.data.overdue} field="drawsSince" label="הגרלות מאז" />
        </Card>
      </div>

      <div className="section-gap">
        <Card title="🔺 שלשות נפוצות">
          <div className="table-wrap" style={{ maxHeight: 360 }}>
            <table>
              <thead><tr><th>שלשה</th><th>הופעות</th></tr></thead>
              <tbody>
                {triples.data.triples.map((t, i) => (
                  <tr key={i}>
                    <td><div className="balls">{[t.a, t.b, t.c].map((n) => <Ball key={n} n={n} sm />)}</div></td>
                    <td><b>{t.count}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="🌡️ Heatmap זוגות">
          <p className="hint" style={{ marginBottom: 12 }}>ככל שהתא כהה/אדום יותר — הזוג הופיע יותר. שורה=מספר ראשון, עמודה=מספר שני.</p>
          <Heatmap all={pairs.data.all} />
        </Card>
      </div>
    </div>
  );
}

function PairTable({ rows, field, label }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 420 }}>
      <table>
        <thead><tr><th>זוג</th><th>{label}</th></tr></thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td><div className="balls"><Ball n={p.a} sm /><Ball n={p.b} sm /></div></td>
              <td><b>{p[field]}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Heatmap({ all }) {
  const max = useMemo(() => Math.max(...all.map((p) => p.count), 1), [all]);
  const map = useMemo(() => {
    const m = {};
    for (const p of all) m[`${p.a}-${p.b}`] = p.count;
    return m;
  }, [all]);
  const nums = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);
  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="heat" style={{ minWidth: 720 }}>
        <div className="cell" />
        {nums.map((c) => <div key={'h' + c} className="cell muted">{c}</div>)}
        {nums.map((r) => (
          <React.Fragment key={'r' + r}>
            <div className="cell muted">{r}</div>
            {nums.map((c) => {
              const key = r < c ? `${r}-${c}` : `${c}-${r}`;
              const v = r === c ? null : (map[key] || 0);
              const t = v == null ? 0 : v / max;
              const bg = v == null ? '#0b1020' : `rgba(${Math.round(108 + t * 147)},${Math.round(140 - t * 80)},${Math.round(255 - t * 180)},${0.15 + t * 0.85})`;
              return <div key={r + '-' + c} className="cell" style={{ background: bg }} title={v != null ? `${r}+${c}: ${v}` : ''} />;
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
