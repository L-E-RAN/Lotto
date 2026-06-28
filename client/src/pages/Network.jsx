import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../lib/api.js';
import { Card, Balls, Ball, Loading, ErrorBox, Disclaimer, useApi } from '../components/UI.jsx';

const LAYER_COLOR = { core: '#e0473b', bridge: '#e0941a', periphery: '#4f7fd6' };
const LAYER_HE = { core: 'ליבה', bridge: 'גשר', periphery: 'פריפריה' };

export default function Network() {
  const { data, error, loading } = useApi(() => api.network(10));
  if (loading) return <Loading text="בונה מפת קשרים..." />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div>
      <div className="between">
        <div>
          <h1 className="page-title">מפת קשרים — צירופים מומלצים</h1>
          <p className="page-sub">ניתוח רשת קו-הופעה · {data.total} הגרלות · יעד: הגרלה #{data.target_draw_number}</p>
        </div>
      </div>

      <div className="grid cols-2">
        <Card title="🕸️ גרף הרשת"><NetworkGraph data={data} /></Card>
        <div className="grid" style={{ gap: 18 }}>
          <Card title="🔴 שכבת ליבה (Core)"><LayerRow items={data.layers.core} color={LAYER_COLOR.core} /></Card>
          <Card title="🟠 שכבת גשר (Bridge)"><LayerRow items={data.layers.bridge} color={LAYER_COLOR.bridge} /></Card>
          <Card title="🔵 שכבת פריפריה (Periphery)"><LayerRow items={data.layers.periphery} color={LAYER_COLOR.periphery} /></Card>
        </div>
      </div>

      <div className="grid cols-3 section-gap">
        <Card title="📊 סטטיסטיקות כלליות">
          <Stat l="מספרים שונים" v={`${data.stats.distinct} מתוך 37`} />
          <Stat l="ממוצע הופעות למספר" v={data.stats.avgAppearances} />
          <Stat l="הכי הרבה הופעות" v={`${data.stats.topNumber} (${data.stats.topCount})`} />
          <Stat l="הכי מעט הופעות" v={`${data.stats.minNumber} (${data.stats.minCount})`} />
        </Card>
        <Card title="🏆 מספרים TOP הופעות">
          {data.topNumbers.map((n, i) => (
            <div key={n.number} className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">{i + 1}.</span>
              <Ball n={n.number} sm />
              <span className="muted">{n.freq} הופעות</span>
            </div>
          ))}
        </Card>
        <Card title="🧩 חלוקה שכבתית"><LayerPie layers={data.layers} /></Card>
      </div>

      <div className="grid cols-2 section-gap">
        <Card title="🔗 קשרים חזקים במיוחד">
          <div className="grid cols-2" style={{ gap: 8 }}>
            {data.strongPairs.map((p, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', background: 'var(--card-2)', borderRadius: 8, padding: '4px 10px' }}>
                <span>{p.a} – {p.b}</span>
                <span className="tag">{p.count}× · lift {p.lift}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="💡 תובנות מרכזיות">
          <ul className="explain-list">
            {data.insights.map((s, i) => <li key={i}>• <span>{s}</span></li>)}
          </ul>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="🎯 המלצות משחק (3 מודלים)">
          <div className="grid cols-3">
            {Object.values(data.models).map((m) => (
              <div key={m.label} className="card" style={{ padding: 14 }}>
                <div className="label" style={{ color: 'var(--accent)', fontWeight: 800, marginBottom: 8, fontSize: 13 }}>{m.label}</div>
                <Balls numbers={m.numbers} strong={m.strong} sm />
                <div className="row" style={{ marginTop: 10, gap: 6 }}>
                  <span className="tag" style={{ color: LAYER_COLOR.core }}>ליבה {m.composition.core}</span>
                  <span className="tag" style={{ color: LAYER_COLOR.bridge }}>גשר {m.composition.bridge}</span>
                  <span className="tag" style={{ color: LAYER_COLOR.periphery }}>פריפ׳ {m.composition.periphery}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="section-gap">
        <Card title="🏅 10 צירופים מדורגים (מבוססי-רשת)">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>צירוף</th><th>חזק</th><th>ציון</th><th>קישוריות</th><th>ליבה/גשר/פריפ׳</th><th>סכום</th></tr>
              </thead>
              <tbody>
                {data.recommendations.map((t) => (
                  <tr key={t.rank}>
                    <td><b>{t.rank}</b></td>
                    <td><Balls numbers={t.numbers} sm /></td>
                    <td><Ball n={t.strong} type="strong" sm /></td>
                    <td><b>{t.score}</b></td>
                    <td>{t.connectivity}%</td>
                    <td>
                      <span style={{ color: LAYER_COLOR.core }}>{t.composition.core}</span> /
                      <span style={{ color: LAYER_COLOR.bridge }}> {t.composition.bridge}</span> /
                      <span style={{ color: LAYER_COLOR.periphery }}> {t.composition.periphery}</span>
                    </td>
                    <td className="muted">{t.pattern.sum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="disclaimer neutral section-gap">
        🎲 <span>מפת הקשרים מתארת קו-הופעה בעבר בלבד. ערכי ה-lift קרובים ל-1 — כלומר הקשרים עקביים עם אקראיות. אין לכך ערך מנבא.</span>
      </div>
      <Disclaimer />
    </div>
  );
}

function NetworkGraph({ data }) {
  const SIZE = 560, cx = SIZE / 2, cy = SIZE / 2;
  const { pos, shown } = useMemo(() => {
    const pos = {};
    const core = data.layers.core, bridge = data.layers.bridge, periphery = data.layers.periphery.slice(0, 16);
    // ליבה: צומת מרכזי + טבעת פנימית
    pos[core[0].number] = { x: cx, y: cy, r: 26, layer: 'core', node: core[0] };
    placeRing(core.slice(1), 120, cx, cy, pos, 22, 'core');
    placeRing(bridge, 200, cx, cy, pos, 17, 'bridge');
    placeRing(periphery, 255, cx, cy, pos, 13, 'periphery');
    const shown = new Set(Object.keys(pos).map(Number));
    return { pos, shown };
  }, [data]);

  const edges = data.strongPairs.filter((p) => pos[p.a] && pos[p.b]);
  const maxC = Math.max(...edges.map((e) => e.count), 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto' }}>
        {[120, 200, 255].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#26305a" strokeDasharray="3 5" strokeWidth="1" />
        ))}
        {edges.map((e, i) => {
          const a = pos[e.a], b = pos[e.b];
          const op = 0.12 + (e.count / maxC) * 0.7;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9fb0ff" strokeOpacity={op} strokeWidth={1 + (e.count / maxC) * 2.5} />;
        })}
        {Object.entries(pos).map(([num, p]) => (
          <g key={num}>
            <circle cx={p.x} cy={p.y} r={p.r} fill={LAYER_COLOR[p.layer]} stroke="#0b1020" strokeWidth="2" />
            <text x={p.x} y={p.y - 1} textAnchor="middle" fontSize={p.r > 20 ? 15 : 12} fontWeight="800" fill="#fff">{num}</text>
            <text x={p.x} y={p.y + 11} textAnchor="middle" fontSize="8" fill="#ffffffcc">({p.node.freq})</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function placeRing(items, radius, cx, cy, pos, r, layer) {
  const n = items.length;
  items.forEach((it, i) => {
    const ang = (-Math.PI / 2) + (i / n) * Math.PI * 2;
    pos[it.number] = { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang), r, layer, node: it };
  });
}

function LayerRow({ items, color }) {
  return (
    <div className="balls">
      {items.map((n) => (
        <div key={n.number} title={`${n.freq} הופעות`} style={{
          width: 38, height: 38, borderRadius: '50%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: color, color: '#fff', fontWeight: 800, fontSize: 13,
        }}>
          {n.number}<span style={{ fontSize: 8, opacity: 0.85 }}>{n.freq}</span>
        </div>
      ))}
    </div>
  );
}

function LayerPie({ layers }) {
  const d = [
    { name: 'ליבה', value: layers.core.length, c: LAYER_COLOR.core },
    { name: 'גשר', value: layers.bridge.length, c: LAYER_COLOR.bridge },
    { name: 'פריפריה', value: layers.periphery.length, c: LAYER_COLOR.periphery },
  ];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={d} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name} ${e.value}`}>
          {d.map((x, i) => <Cell key={i} fill={x.c} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#161e3a', border: '1px solid #26305a', borderRadius: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Stat({ l, v }) {
  return (
    <div className="between" style={{ marginBottom: 10 }}>
      <span className="muted" style={{ fontSize: 13 }}>{l}</span>
      <span style={{ fontWeight: 800 }}>{v}</span>
    </div>
  );
}
