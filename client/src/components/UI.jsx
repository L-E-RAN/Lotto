import React from 'react';

export function Ball({ n, type, sm }) {
  return <div className={`ball ${sm ? 'sm' : ''} ${type || ''}`}>{n}</div>;
}

export function Balls({ numbers, strong, type, sm }) {
  return (
    <div className="balls">
      {numbers.map((n) => <Ball key={n} n={n} type={type} sm={sm} />)}
      {strong != null && <Ball n={strong} type="strong" sm={sm} />}
    </div>
  );
}

export function Card({ title, children, className = '', extra }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="between">
          <h3>{title}</h3>
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}

export function Disclaimer() {
  return (
    <div className="disclaimer section-gap">
      <span className="icon">⚠️</span>
      <span>
        התחזית מבוססת על ניתוח סטטיסטי של נתוני עבר בלבד. אין אפשרות להבטיח או לנבא תוצאות לוטו.
        השימוש במערכת הוא לצורכי ניתוח ובידור בלבד.
      </span>
    </div>
  );
}

export function Loading({ text = 'טוען נתונים...' }) {
  return <div className="loading">⏳ {text}</div>;
}

export function ErrorBox({ error }) {
  return <div className="error">⚠️ {error?.message || String(error)}</div>;
}

export function Trend({ trend }) {
  const cls = trend === 'עולה' ? 'up' : trend === 'יורד' ? 'down' : 'flat';
  const arrow = trend === 'עולה' ? '↗' : trend === 'יורד' ? '↘' : '→';
  return <span className={`badge ${cls}`}>{arrow} {trend}</span>;
}

export function useApi(fn, deps = []) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const run = React.useCallback(() => {
    setLoading(true); setError(null);
    Promise.resolve(fn())
      .then((d) => setData(d))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}
