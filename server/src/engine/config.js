// כללי הלוטו הישראלי: 6 מספרים מתוך 1..37 + מספר חזק 1..7
export const MAX_NUMBER = 37;
export const STRONG_MAX = 7;
export const PICK = 6;
export const LOW_HIGH_SPLIT = 19; // נמוך: 1..19, גבוה: 20..37

// טווח סכום נפוץ (ייקבע גם דינמית מההיסטוריה, אלו ערכי ברירת מחדל)
export const DEFAULT_SUM_MIN = 90;
export const DEFAULT_SUM_MAX = 160;

export function decadeOf(n) {
  return Math.floor((n - 1) / 10); // 0:1-10, 1:11-20, 2:21-30, 3:31-37
}

export function isEven(n) {
  return n % 2 === 0;
}

export function isLow(n) {
  return n <= LOW_HIGH_SPLIT;
}

export const DISCLAIMER =
  'התחזית מבוססת על ניתוח סטטיסטי של נתוני עבר בלבד. אין אפשרות להבטיח או לנבא תוצאות לוטו. השימוש במערכת הוא לצורכי ניתוח ובידור בלבד.';
