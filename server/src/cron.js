import cron from 'node-cron';
import { syncDraws } from './service.js';

// בדיקה יומית לעדכון הגרלות חדשות (כל יום ב-23:30)
export function startCron() {
  cron.schedule('30 23 * * *', async () => {
    console.log('[cron] מריץ בדיקת עדכון יומית...');
    try {
      const r = await syncDraws();
      console.log('[cron] תוצאה:', JSON.stringify(r));
    } catch (e) {
      console.error('[cron] שגיאה:', e.message);
    }
  }, { timezone: 'Asia/Jerusalem' });
  console.log('[cron] תזמון יומי הופעל (23:30, שעון ישראל).');
}
