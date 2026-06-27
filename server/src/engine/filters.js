import { decadeOf, isEven, isLow } from './config.js';
import { patternOf } from './stats.js';

// כללי הסינון לצירוף "הגיוני" (anti-popularity + תבניות סבירות)
export function passesFilters(nums, ctx = {}) {
  const reasons = [];
  const p = patternOf(nums);
  const { sumMin = 90, sumMax = 160, existingSet = null } = ctx;

  if (p.even < 2 || p.even > 4) reasons.push('איזון זוגי/אי-זוגי חורג');
  if (p.low < 2 || p.low > 4) reasons.push('איזון נמוך/גבוה חורג');
  if (p.maxSameDecade > 2) reasons.push('יותר מ-2 מספרים מאותו עשור');
  if (p.sequences > 1) reasons.push('יותר מרצף אחד');
  if (p.maxRun > 3) reasons.push('רצף ארוך מדי');
  if (!nums.some((n) => n > 31)) reasons.push('אין מספר מעל 31');
  if (p.sum < sumMin || p.sum > sumMax) reasons.push('סכום מחוץ לטווח הנפוץ');
  if (existingSet && existingSet.has(keyOf(nums))) reasons.push('צירוף שכבר הופיע בעבר');

  return { ok: reasons.length === 0, reasons, pattern: p };
}

export function keyOf(nums) {
  return [...nums].sort((a, b) => a - b).join('-');
}

// בודק האם הצירוף נראה כמו בחירה אנושית טיפוסית (לצורך anti_popularity)
export function humanLikenessPenalty(nums) {
  const p = patternOf(nums);
  let penalty = 0;
  if (nums.every((n) => n <= 31)) penalty += 25; // תאריכי לידה
  if (p.birthdayLike) penalty += 15;
  if (p.maxRun >= 3) penalty += 20; // 1,2,3...
  if (p.sequences >= 2) penalty += 15;
  if (p.maxSameDecade >= 3) penalty += 15;
  // סימטריה / מרווחים שווים
  const sorted = [...nums].sort((a, b) => a - b);
  const diffs = sorted.slice(1).map((n, i) => n - sorted[i]);
  if (new Set(diffs).size === 1) penalty += 20; // הפרשים קבועים
  return penalty;
}
