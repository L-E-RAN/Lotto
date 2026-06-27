// הרצה מקומית: מפעיל שרת Express + תזמון cron.
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import app, { bootstrap } from './app.js';
import { startCron } from './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// הגשת build של הלקוח אם קיים (פרודקשן מקומי)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🎰 LottoStat AI — שרת פעיל על http://localhost:${PORT}`);
  bootstrap();
  startCron();
});
