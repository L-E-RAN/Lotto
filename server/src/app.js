// אפליקציית Express משותפת — נטענת גם בהרצה מקומית וגם כפונקציית serverless ב-Vercel.
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';
import { getLatestPredictions } from './store.js';
import { generateNextPredictions, refreshModelPerformance } from './service.js';

let bootstrapped = false;
export function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    if (!getLatestPredictions().length) generateNextPredictions();
    refreshModelPerformance({ maxTests: 150 });
  } catch (e) {
    console.error('[bootstrap] שגיאה:', e.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// אתחול עצל בבקשה הראשונה (חשוב ל-serverless cold start)
app.use((req, res, next) => { bootstrap(); next(); });

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);

export default app;
