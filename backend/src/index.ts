import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDb } from './db/database';
import { seed } from './db/seed';
import customersRouter from './routes/customers';
import segmentsRouter from './routes/segments';
import campaignsRouter from './routes/campaigns';
import aiRouter from './routes/ai';
import authRouter from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    FRONTEND_URL,
    'http://localhost:3000',
    'https://reachiq.vercel.app',
    'https://reachiq-frontend.vercel.app',
    /\.vercel\.app$/,
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Initialize DB & Seed ──────────────────────────────────────────────────────
try {
  getDb(); // Initialize schema
  seed().catch((e) => console.error('Seed error:', e)); // Seed if empty (async)
} catch (e) {
  console.error('DB initialization error:', e);
}

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/ai', aiRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM customers) as customers,
      (SELECT COUNT(*) FROM segments) as segments,
      (SELECT COUNT(*) FROM campaigns) as campaigns
  `).get();
  res.json({ status: 'ok', stats, timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.json({ name: 'ReachIQ API', version: '1.0.0', status: 'running' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 ReachIQ backend running on http://localhost:${PORT}`);
});

export default app;
