import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /customers - list with pagination & search
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { page = '1', limit = '20', search = '', city = '', gender = '', sort = 'created_at', order = 'desc' } = req.query as Record<string, string>;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const searchTerm = `%${search}%`;

  const allowedSort = ['name', 'email', 'age', 'city', 'total_orders', 'total_spend', 'last_order_date', 'created_at'];
  const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (search) {
    whereClause += ' AND (name LIKE ? OR email LIKE ? OR city LIKE ?)';
    params.push(searchTerm, searchTerm, searchTerm);
  }
  if (city) { whereClause += ' AND city = ?'; params.push(city); }
  if (gender) { whereClause += ' AND gender = ?'; params.push(gender); }

  const customers = db.prepare(`
    SELECT * FROM customers ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all([...params, parseInt(limit), offset]);

  const total = (db.prepare(`SELECT COUNT(*) as c FROM customers ${whereClause}`).get(params) as { c: number }).c;

  res.json({ customers, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
});

// GET /customers/stats - aggregate stats
router.get('/stats', (_req: Request, res: Response) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_customers,
      SUM(total_spend) as total_revenue,
      AVG(total_spend) as avg_spend,
      AVG(total_orders) as avg_orders,
      COUNT(CASE WHEN created_at > date('now', '-30 days') THEN 1 END) as new_this_month,
      COUNT(CASE WHEN last_order_date < date('now', '-90 days') OR last_order_date IS NULL THEN 1 END) as lapsed_count
    FROM customers
  `).get();

  const cityBreakdown = db.prepare(`
    SELECT city, COUNT(*) as count FROM customers GROUP BY city ORDER BY count DESC LIMIT 6
  `).all();

  const genderBreakdown = db.prepare(`
    SELECT gender, COUNT(*) as count FROM customers GROUP BY gender
  `).all();

  res.json({ ...stats as object, cityBreakdown, genderBreakdown });
});

// GET /customers/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
  const commsHistory = db.prepare(`
    SELECT cl.*, c.name as campaign_name FROM communication_log cl
    JOIN campaigns c ON cl.campaign_id = c.id
    WHERE cl.customer_id = ? ORDER BY cl.sent_at DESC LIMIT 10
  `).all(req.params.id);

  res.json({ ...customer as object, orders, commsHistory });
});

// POST /customers - create single customer
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, email, phone, age, gender, city, tags } = req.body;

  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO customers (id, name, email, phone, age, gender, city, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email, phone || null, age || null, gender || null, city || null, JSON.stringify(tags || []));

  res.status(201).json({ id, message: 'Customer created' });
});

// POST /customers/import - CSV bulk import
router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const db = getDb();
  const content = req.file.buffer.toString('utf-8');

  let records: any[];
  try {
    records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    return res.status(400).json({ error: 'Invalid CSV format' });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO customers (id, name, email, phone, age, gender, city, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  const insertAll = db.transaction(() => {
    for (const row of records) {
      if (!row.name || !row.email) { skipped++; continue; }
      try {
        insert.run(uuidv4(), row.name, row.email, row.phone || null, row.age ? parseInt(row.age) : null, row.gender || null, row.city || null, '[]');
        imported++;
      } catch { skipped++; }
    }
  });

  insertAll();
  res.json({ imported, skipped, total: records.length });
});

// PUT /customers/:id
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, phone, age, gender, city, tags } = req.body;
  db.prepare(`
    UPDATE customers SET name=?, phone=?, age=?, gender=?, city=?, tags=? WHERE id=?
  `).run(name, phone, age, gender, city, JSON.stringify(tags || []), req.params.id);
  res.json({ message: 'Updated' });
});

// DELETE /customers/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

export default router;
