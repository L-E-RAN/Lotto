import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Draws from './pages/Draws.jsx';
import Numbers from './pages/Numbers.jsx';
import Strong from './pages/Strong.jsx';
import Pairs from './pages/Pairs.jsx';
import Patterns from './pages/Patterns.jsx';
import Predictions from './pages/Predictions.jsx';
import Backtest from './pages/Backtest.jsx';
import Tools from './pages/Tools.jsx';
import Network from './pages/Network.jsx';
import Randomness from './pages/Randomness.jsx';
import { useTheme } from './components/UI.jsx';

const NAV = [
  { to: '/', label: 'דשבורד', icon: '📊', end: true },
  { to: '/draws', label: 'הגרלות', icon: '🎰' },
  { to: '/numbers', label: 'סטטיסטיקת מספרים', icon: '🔢' },
  { to: '/strong', label: 'מספר חזק', icon: '⭐' },
  { to: '/pairs', label: 'זוגות ושלשות', icon: '🔗' },
  { to: '/patterns', label: 'תבניות', icon: '🧩' },
  { to: '/predictions', label: 'תחזית הבאה', icon: '🔮' },
  { to: '/network', label: 'מפת קשרים', icon: '🕸️' },
  { to: '/tools', label: 'מחולל טורים', icon: '🎟️' },
  { to: '/backtest', label: 'Backtesting', icon: '🧪' },
  { to: '/randomness', label: 'מבחני אקראיות', icon: '🔬' },
];

export default function App() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  return (
    <div className="layout">
      <div className="topbar">
        <div className="brand"><span className="dot" /> LottoStat AI</div>
        <button className="btn ghost" onClick={() => setOpen((o) => !o)}>☰ תפריט</button>
      </div>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="dot" />
          <div>LottoStat AI<small>ניתוח סטטיסטי של הלוטו</small></div>
        </div>
        <nav className="nav" onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn ghost theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀️ מצב בהיר' : '🌙 מצב כהה'}
        </button>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/draws" element={<Draws />} />
          <Route path="/numbers" element={<Numbers />} />
          <Route path="/strong" element={<Strong />} />
          <Route path="/pairs" element={<Pairs />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/network" element={<Network />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/randomness" element={<Randomness />} />
        </Routes>
      </main>
    </div>
  );
}
