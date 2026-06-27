import React, { useState } from 'react';
import { api, downloadCSV } from '../lib/api.js';
import { Balls, Loading, ErrorBox, useApi } from '../components/UI.jsx';

export default function Draws() {
  const [year, setYear] = useState('');
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);
  const { data, error, loading, reload } = useApi(() => api.draws({ year, q }), [year, q]);

  async function doSync() {
    setSyncing(true); setMsg(null);
    try {
      const r = await api.sync();
      setMsg(r.added > 0
        ? `נוספו ${r.added} הגרלות חדשות ממקור ${r.source}.`
        : r.source === 'none'
          ? 'לא ניתן היה למשוך נתונים חיים כעת (המקור לא זמין). הנתונים הקיימים נשמרו.'
          : 'אין הגרלות חדשות לעדכון.');
      reload();
    } catch (e) { setMsg('שגיאה בעדכון: ' + e.message); }
    finally { setSyncing(false); }
  }

  async function importFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    try {
      const csv = await file.text();
      const r = await api.importCsv(csv);
      setMsg(`ייבוא הושלם: ${r.added} הגרלות נוספו (מתוך ${r.valid} תקינות, ${r.received} שורות). פורמט: מס׳הגרלה,תאריך,6 מספרים,חזק`);
      reload();
    } catch (err) { setMsg('שגיאת ייבוא: ' + err.message); }
    finally { e.target.value = ''; }
  }

  return (
    <div>
      <h1 className="page-title">הגרלות</h1>
      <p className="page-sub">היסטוריית כל ההגרלות במאגר {data ? `· ${data.total} רשומות` : ''}</p>

      <div className="toolbar">
        <input placeholder="חיפוש לפי תאריך / מספר הגרלה" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">כל השנים</option>
          {data?.years?.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={doSync} disabled={syncing}>{syncing ? 'מעדכן...' : '🔄 עדכון ידני'}</button>
        <label className="btn ghost" style={{ cursor: 'pointer' }}>
          ⬆️ ייבוא CSV
          <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={importFile} />
        </label>
        <button className="btn ghost" onClick={() => downloadCSV(data?.draws || [])}>⬇️ ייצוא CSV</button>
      </div>

      {msg && <div className="disclaimer" style={{ marginBottom: 14 }}>ℹ️ {msg}</div>}

      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#הגרלה</th><th>תאריך</th><th>מספרים</th><th>חזק</th><th>מקור</th></tr>
            </thead>
            <tbody>
              {data.draws.map((d) => (
                <tr key={d.id}>
                  <td>{d.draw_number}</td>
                  <td>{d.draw_date}</td>
                  <td><Balls numbers={[d.n1, d.n2, d.n3, d.n4, d.n5, d.n6]} sm /></td>
                  <td><div className="ball strong sm">{d.strong_number}</div></td>
                  <td className="muted">{d.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
