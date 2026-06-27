// המאגר נטען אוטומטית מ-seedData.json דרך store.js.
// קובץ זה נשמר לתאימות לאחור עם הסקריפט npm run seed.
import { getDrawCount } from './store.js';

export function seedIfEmpty() {
  return 0; // ה-dataset כבר נטען בזיכרון מ-seedData.json
}

if (process.argv[1]?.endsWith('seed.js')) {
  console.log(`המאגר טעון: ${getDrawCount()} הגרלות (מתוך seedData.json).`);
  process.exit(0);
}
