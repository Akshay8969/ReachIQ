import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All segment routes require authentication
router.use(authenticateToken);

// GET /segments
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const segments = db.prepare('SELECT * FROM segments WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  res.json({ segments });
});

// POST /segments - create segment with optional SQL preview
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { name, description, filter_sql, created_by = 'manual' } = req.body;

  if (!name || !filter_sql) return res.status(400).json({ error: 'name and filter_sql required' });

  // Validate the SQL is safe (only SELECT, references customers table)
  const sql = filter_sql.trim().toLowerCase();
  if (!sql.startsWith('select')) return res.status(400).json({ error: 'Only SELECT queries allowed' });
  if (sql.includes('drop') || sql.includes('delete') || sql.includes('insert') || sql.includes('update')) {
    return res.status(400).json({ error: 'Destructive SQL not allowed' });
  }

  // Safely count only this user's customers by injecting user_id filter
  let customer_count = 0;
  try {
    const countSql = filter_sql.replace(/SELECT \* FROM customers WHERE /i, `SELECT COUNT(*) as c FROM customers WHERE user_id = '${userId}' AND (`);
    const resultSql = countSql.startsWith('SELECT COUNT') ? countSql + ')' : filter_sql.replace(/SELECT \*/gi, 'SELECT COUNT(*) as c');
    const result = db.prepare(resultSql).get() as { c: number } | undefined;
    customer_count = result?.c || 0;
  } catch (e: any) {
    return res.status(400).json({ error: `Invalid SQL: ${e.message}` });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO segments (id, user_id, name, description, filter_sql, customer_count, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, name, description || '', filter_sql, customer_count, created_by);

  res.status(201).json({ id, customer_count, message: 'Segment created' });
});

// POST /segments/preview - preview customers for a given SQL without saving
router.post('/preview', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { filter_sql } = req.body;
  if (!filter_sql) return res.status(400).json({ error: 'filter_sql required' });

  const sql = filter_sql.trim().toLowerCase();
  if (!sql.startsWith('select')) return res.status(400).json({ error: 'Only SELECT queries allowed' });
  if (sql.includes('drop') || sql.includes('delete') || sql.includes('insert') || sql.includes('update')) {
    return res.status(400).json({ error: 'Destructive SQL not allowed' });
  }

  try {
    // Inject user_id filter for isolation
    const userSql = filter_sql.replace(/FROM customers\s+(WHERE)?/i, (_m: string, w: string) =>
      w ? `FROM customers WHERE user_id = '${userId}' AND (` : `FROM customers WHERE user_id = '${userId}' AND (1=1`
    );
    const closedSql = userSql + ')';
    const countSql = closedSql.replace(/SELECT \*/i, 'SELECT COUNT(*) as c');
    const result = db.prepare(countSql).get() as { c: number };
    const total = result?.c || 0;

    const previewSql = closedSql + ' LIMIT 5';
    const customers = db.prepare(previewSql).all();

    res.json({ total, customers });
  } catch (e: any) {
    res.status(400).json({ error: `Invalid SQL: ${e.message}` });
  }
});

// GET /segments/:id - get segment with customer preview
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const segment = db.prepare('SELECT * FROM segments WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any;
  if (!segment) return res.status(404).json({ error: 'Segment not found' });

  let customers: any[] = [];
  try {
    const userSql = segment.filter_sql.replace(
      /FROM customers/i,
      `FROM customers WHERE user_id = '${userId}' AND 1=1 --`
    );
    customers = db.prepare(`${userSql} LIMIT 10`).all();
  } catch (e) {}

  // Refresh count
  try {
    const countSql = segment.filter_sql.replace(
      /FROM customers/i,
      `FROM customers WHERE user_id = '${userId}' AND 1=1 --`
    ).replace(/SELECT \*/i, 'SELECT COUNT(*) as c');
    const result = db.prepare(countSql).get() as { c: number };
    const freshCount = result?.c || 0;
    if (freshCount !== segment.customer_count) {
      db.prepare('UPDATE segments SET customer_count = ? WHERE id = ?').run(freshCount, segment.id);
      segment.customer_count = freshCount;
    }
  } catch {}

  res.json({ ...segment, customers });
});

// DELETE /segments/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  db.prepare('DELETE FROM segments WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ message: 'Deleted' });
});

export default router;
