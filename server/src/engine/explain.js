import { isEven, isLow } from './config.js';

// יוצר נימוק בעברית לכל מספר נבחר
export function explainNumbers(nums, ctx) {
  const out = [];
  const sorted = [...nums].sort((a, b) => a - b);
  const evenCount = sorted.filter(isEven).length;
  const lowCount = sorted.filter(isLow).length;

  for (const n of sorted) {
    const s = ctx.nstats[n - 1];
    const reasons = [];
    const avgRecent = ctx.nstats.reduce((a, x) => a + x.last25, 0) / ctx.nstats.length;

    if (s.last25 > avgRecent * 1.2) reasons.push('מספר חם — הופיע לאחרונה בתדירות גבוהה');
    else if (s.drawsSince > 15) reasons.push(`מספר קר — לא הופיע ${s.drawsSince} הגרלות (הופעת עבר אינה מחייבת הופעה עתידית)`);

    const pairRank = ctx.pairScore[n];
    const maxPair = Math.max(...ctx.pairScore.slice(1));
    if (pairRank > maxPair * 0.6) reasons.push('משתלב היטב בזוגות נפוצים מההיסטוריה');

    if (n > 31) reasons.push('מעל 31 — משפר פיזור ומפחית בחירה אנושית פופולרית (תאריכי לידה)');
    else if (n > 19) reasons.push('בטווח הגבוה — תורם לאיזון נמוך/גבוה');

    if (isEven(n) && evenCount <= 3) reasons.push('זוגי — תורם לאיזון זוגי/אי-זוגי');
    if (!isEven(n) && evenCount >= 3) reasons.push('אי-זוגי — תורם לאיזון זוגי/אי-זוגי');

    if (s.trend === 'עולה') reasons.push('מגמת הופעה עולה');

    if (reasons.length === 0) reasons.push('נבחר לאיזון כללי של הצירוף ולפיזור תקין');
    out.push({ number: n, reasons });
  }
  return out;
}
