// מבחני מובהקות סטטיסטית — ליושרה אנליטית, לא לניבוי.
// כל הפונקציות טהורות.

// --- פונקציות עזר מתמטיות ---

// erf מקורב (Abramowitz & Stegun 7.1.26)
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

// CDF של התפלגות נורמלית סטנדרטית
export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// פונקציית גמא (Lanczos)
function gammaln(x) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let xx = x, y = x;
  let tmp = xx + 5.5;
  tmp -= (xx + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += g[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / xx);
}

// פונקציית גמא לא-שלמה מוסדרת Q(a,x) = 1 - P(a,x) (survival)
function gammaincQ(a, x) {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 1;
  if (x < a + 1) {
    // סדרה ל-P
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 200; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }
  // שבר משולב ל-Q
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

// p-value של חי-בריבוע: P(X^2 > chi2) עם df דרגות חופש
export function chiSquarePValue(chi2, df) {
  return gammaincQ(df / 2, chi2 / 2);
}

// --- מבחנים ---

// מבחן טיב-התאמה לאחידות.
// observed: מערך ספירות לכל קטגוריה. totalObservations: סך התצפיות.
export function chiSquareUniform(observed, totalObservations) {
  const k = observed.length;
  const expected = totalObservations / k;
  let chi2 = 0;
  for (const o of observed) chi2 += ((o - expected) ** 2) / expected;
  const df = k - 1;
  const p = chiSquarePValue(chi2, df);
  return {
    chi2: Math.round(chi2 * 100) / 100,
    df,
    expected: Math.round(expected * 100) / 100,
    pValue: Math.round(p * 10000) / 10000,
    significant: p < 0.05,
    verdict: p < 0.05
      ? 'נמצאה סטייה מובהקת מאחידות (p<0.05) — ייתכן ליקוי בנתונים או הטיה אמיתית.'
      : 'ההתפלגות עקבית עם אקראיות מלאה (p≥0.05). אין עדות סטטיסטית למספרים "חמים" או "קרים" אמיתיים.',
  };
}

// רווח סמך Wilson 95% לפרופורציה p=count/n
export function wilsonInterval(count, n, z = 1.96) {
  if (n === 0) return { p: 0, low: 0, high: 0, margin: 0 };
  const p = count / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    p: Math.round(p * 10000) / 100,
    low: Math.round((center - half) * 10000) / 100,
    high: Math.round((center + half) * 10000) / 100,
    margin: Math.round(half * 10000) / 100,
  };
}

// מבחן z להפרש בין שני ממוצעים (Welch, קירוב נורמלי — n גדול)
export function zTestDiff(meanA, sdA, nA, meanB, sdB, nB) {
  const se = Math.sqrt((sdA * sdA) / nA + (sdB * sdB) / nB);
  if (se === 0) return { z: 0, pValue: 1, significant: false };
  const z = (meanA - meanB) / se;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return {
    z: Math.round(z * 100) / 100,
    pValue: Math.round(p * 10000) / 10000,
    significant: p < 0.05,
  };
}

export function mean(arr) {
  return arr.reduce((s, x) => s + x, 0) / (arr.length || 1);
}
export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}
