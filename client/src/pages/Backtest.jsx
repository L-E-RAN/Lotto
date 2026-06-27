import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../lib/api.js';
import { Card, Loading, ErrorBox, Disclaimer } from '../components/UI.jsx';
import { modelHe } from './Dashboard.jsx';

export default function Backtest() {
  const [model, setModel] = useState('all');
  const [maxTests, setMaxTests] = useState(200);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true); setError(null);
    try { const r = await api.backtest({ model, maxTests: Number(maxTests) }); setResults(r.results); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }

  const chart = (results || []).map((r) => ({
    name: modelHe(r.model_name), מודל: r.avg_hits, אקראי: r.random_avg_hits,
  }));

  return (
    <div>
      <h1 className="page-title">Backtesting</h1>
      <p className="page-sub">
        בדיקת עבר: המערכת לוקחת היסטוריה עד הגרלה X, מייצרת תחזית להגרלה X+1, משווה לתוצאה האמיתית — וחוזרת על זה לאורך ההיסטוריה.
      </p>

      <div className="toolbar">
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="all">כל המודלים</option>
          <option value="hot_numbers_model">חמים</option>
          <option value="cold_numbers_model">קרים</option>
          <option value="weighted_model">משוקלל</option>
          <option value="pair_model">זוגות</option>
          <option value="anti_popularity_model">אנטי-פופולרי</option>
          <option value="random_filtered_model">אקראי מסונן</option>
        </select>
        <select value={maxTests} onChange={(e) => setMaxTests(e.target.value)}>
          <option value={100}>100 הגרלות</option>
          <option value={200}>200 הגרלות</option>
          <option value={300}>300 הגרלות</option>
        </select>
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'מריץ...' : '🧪 הרץ Backtesting'}</button>
      </div>

      {error && <ErrorBox error={error} />}
      {loading && <Loading text="מריץ בדיקת עבר — עשוי לקחת מספר שניות..." />}

      {results && !loading && (
        <>
          <Card title="📊 ממוצע פגיעות: מודל מול אקראי">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart}>
                <XAxis dataKey="name" tick={{ fill: '#94a0c4', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a0c4' }} />
                <Tooltip contentStyle={{ background: '#161e3a', border: '1px solid #26305a', borderRadius: 10 }} />
                <Legend />
                <Bar dataKey="מודל" fill="#6c8cff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="אקראי" fill="#46d6a8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className={`disclaimer ${results.some((r) => r.significant && r.improvement_vs_random > 0) ? '' : 'neutral'} section-gap`}>
            🎲 <span>
              {results.some((r) => r.significant && r.improvement_vs_random > 0)
                ? 'חלק מהמודלים הראו יתרון מובהק בטווח הנבדק — ייתכן שזו תוצאה אקראית (overfitting). אין לכך תוקף מנבא.'
                : 'אף מודל אינו עולה על בחירה אקראית באופן מובהק (p≥0.05). זו התוצאה הצפויה — תוצאות לוטו אקראיות ואינן ניתנות לניבוי.'}
            </span>
          </div>

          <div className="section-gap">
            <Card title="טבלת תוצאות מפורטת">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>מודל</th><th>בדיקות</th><th>ממוצע פגיעות</th><th>סטיית תקן</th>
                      <th>1+</th><th>2+</th><th>3+</th><th>חזק</th><th>אקראי אמפירי</th><th>שיפור</th><th>p-value</th><th>מובהק?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.model_name}>
                        <td><b>{modelHe(r.model_name)}</b></td>
                        <td>{r.tests}</td>
                        <td><b>{r.avg_hits}</b></td>
                        <td className="muted">±{r.std_hits}</td>
                        <td>{r.hit_1_plus}%</td>
                        <td>{r.hit_2_plus}%</td>
                        <td>{r.hit_3_plus}%</td>
                        <td>{r.strong_hit_rate}%</td>
                        <td className="muted">{r.random_avg_hits}</td>
                        <td>
                          <span className={`badge ${r.improvement_vs_random >= 0 ? 'up' : 'down'}`}>
                            {r.improvement_vs_random >= 0 ? '+' : ''}{r.improvement_vs_random}
                          </span>
                        </td>
                        <td className="muted">{r.p_value}</td>
                        <td>
                          <span className={`badge ${r.significant ? 'up' : 'flat'}`}>
                            {r.significant ? 'מובהק' : 'לא מובהק'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      <Disclaimer />
    </div>
  );
}
