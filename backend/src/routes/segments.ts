import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /segments
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const segments = db.prepare('SELECT * FROM segments ORDER BY created_at DESC').all();
  res.json({ segments });
});

// POST /segments - create segment with optional SQL preview
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, description, filter_sql, created_by = 'manual' } = req.body;

  if (!name || !filter_sql) return res.status(400).json({ error: 'name and filter_sql required' });

  // Validate the SQL is safe (only SELECT, references customers table)
  const sql = filter_sql.trim().toLowerCase();
  if (!sql.startsWith('select')) return res.status(400).json({ error: 'Only SELECT queries allowed' });
  if (sql.includes('drop') || sql.includes('delete') || sql.includes('insert') || sql.includes('update')) {
    return res.status(400).json({ error: 'Destructive SQL not allowed' });
  }

  let customer_count = 0;
  try {
    const countSql = filter_sql.replace(/SELECT \*/gi, 'SELECT COUNT(*) as c');
    const result = db.prepare(countSql).get() as { c: number } | undefined;
    customer_count = result?.c || 0;
  } catch (e: any) {
    return res.status(400).json({ error: `Invalid SQL: ${e.message}` });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO segments (id, name, description, filter_sql, customer_count, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description || '', filter_sql, customer_count, created_by);

  res.status(201).json({ id, customer_count, message: 'Segment created' });
});

// GET /segments/:id - get segment with customer preview
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const segment = db.prepare('SELECT * FROM segments WHERE id = ?').get(req.params.id) as any;
  if (!segment) return res.status(404).json({ error: 'Segment not found' });

  let customers: any[] = [];
  try {
    const previewSql = `${segment.filter_sql} LIMIT 10`;
    customers = db.prepare(previewSql).all();
  } catch (e) {}

  // Refresh count
  try {
    const countSql = segment.filter_sql.replace(/SELECT \*/gi, 'SELECT COUNT(*) as c');
    const result = db.prepare(countSql).get() as { c: number };
    const freshCount = result?.c || 0;
    if (freshCount !== segment.customer_count) {
      db.prepare('UPDATE segments SET customer_count = ? WHERE id = ?').run(freshCount, segment.id);
      segment.customer_count = freshCount;
    }
  } catch {}

  res.json({ ...segment, customers });
});

// POST /segments/preview - preview customers for a given SQL without saving
router.post('/preview', (req: Request, res: Response) => {
  const db = getDb();
  const { filter_sql } = req.body;
  if (!filter_sql) return res.status(400).json({ error: 'filter_sql required' });

  const sql = filter_sql.trim().toLowerCase();
  if (!sql.startsWith('select')) return res.status(400).json({ error: 'Only SELECT queries allowed' });
  if (sql.includes('drop') || sql.includes('delete') || sql.includes('insert') || sql.includes('update')) {
    return res.status(400).json({ error: 'Destructive SQL not allowed' });
  }

  try {
    const countSql = filter_sql.replace(/SELECT \*/gi, 'SELECT COUNT(*) as c');
    const result = db.prepare(countSql).get() as { c: number };
    const total = result?.c || 0;

    const previewSql = `${filter_sql} LIMIT 5`;
    const customers = db.prepare(previewSql).all();

    res.json({ total, customers });
  } catch (e: any) {
    res.status(400).json({ error: `Invalid SQL: ${e.message}` });
  }
});

// DELETE /segments/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM segments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

export default router;
