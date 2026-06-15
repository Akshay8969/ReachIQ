import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { dispatchCampaign } from '../services/channelService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// SSE clients map: campaignId -> response[]
export const sseClients: Map<string, Response[]> = new Map();

// All campaign routes require authentication
router.use(authenticateToken);

// GET /campaigns
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const campaigns = db.prepare(`
    SELECT c.*, s.name as segment_name, s.customer_count as segment_size
    FROM campaigns c
    LEFT JOIN segments s ON c.segment_id = s.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `).all(userId);
  res.json({ campaigns });
});

// GET /campaigns/overview - dashboard stats
router.get('/overview', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_campaigns,
      SUM(sent_count) as total_sent,
      SUM(delivered_count) as total_delivered,
      SUM(clicked_count) as total_clicked,
      ROUND(CAST(SUM(delivered_count) AS REAL) / NULLIF(SUM(sent_count), 0) * 100, 1) as delivery_rate,
      ROUND(CAST(SUM(clicked_count) AS REAL) / NULLIF(SUM(delivered_count), 0) * 100, 1) as click_rate
    FROM campaigns WHERE user_id = ?
  `).get(userId);

  const recentCampaigns = db.prepare(`
    SELECT c.*, s.name as segment_name FROM campaigns c
    LEFT JOIN segments s ON c.segment_id = s.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC LIMIT 5
  `).all(userId);

  const channelBreakdown = db.prepare(`
    SELECT channel, COUNT(*) as count, SUM(sent_count) as total_sent
    FROM campaigns WHERE user_id = ? GROUP BY channel
  `).all(userId);

  res.json({ stats, recentCampaigns, channelBreakdown });
});

// GET /campaigns/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const campaign = db.prepare(`
    SELECT c.*, s.name as segment_name, s.filter_sql
    FROM campaigns c LEFT JOIN segments s ON c.segment_id = s.id
    WHERE c.id = ? AND c.user_id = ?
  `).get(req.params.id, userId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const logs = db.prepare(`
    SELECT cl.*, cu.name as customer_name FROM communication_log cl
    JOIN customers cu ON cl.customer_id = cu.id
    WHERE cl.campaign_id = ? ORDER BY cl.sent_at DESC LIMIT 50
  `).all(req.params.id);

  res.json({ ...campaign as object, logs });
});

// POST /campaigns - create campaign (draft)
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const { name, segment_id, channel, message_template } = req.body;
  if (!name || !channel || !message_template) {
    return res.status(400).json({ error: 'name, channel, and message_template required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO campaigns (id, user_id, name, segment_id, channel, message_template, status)
    VALUES (?, ?, ?, ?, ?, ?, 'draft')
  `).run(id, userId, name, segment_id || null, channel, message_template);

  res.status(201).json({ id, message: 'Campaign draft created' });
});

// POST /campaigns/:id/launch - launch campaign
router.post('/:id/launch', async (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'draft') return res.status(400).json({ error: 'Campaign already launched' });

  // Get target customers from segment (must belong to same user)
  let customers: any[] = [];
  if (campaign.segment_id) {
    const segment = db.prepare('SELECT * FROM segments WHERE id = ? AND user_id = ?').get(campaign.segment_id, userId) as any;
    if (segment) {
      try {
        // Inject user_id filter into segment SQL to enforce isolation
        const safeSql = segment.filter_sql.replace(
          /FROM customers/i,
          `FROM customers WHERE user_id = '${userId}' AND 1=1 --`
        );
        customers = db.prepare(`${safeSql} LIMIT 500`).all();
      } catch (e: any) {
        return res.status(400).json({ error: `Segment SQL error: ${e.message}` });
      }
    }
  } else {
    customers = db.prepare('SELECT * FROM customers WHERE user_id = ? LIMIT 500').all(userId);
  }

  if (customers.length === 0) return res.status(400).json({ error: 'No customers in this segment' });

  // Update campaign to running
  db.prepare(`
    UPDATE campaigns SET status = 'running', launched_at = datetime('now'), sent_count = ? WHERE id = ?
  `).run(customers.length, campaign.id);

  // Create communication logs
  const insertLog = db.prepare(`
    INSERT INTO communication_log (id, user_id, campaign_id, customer_id, channel, recipient, message, status, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', datetime('now'))
  `);

  const insertAllLogs = db.transaction(() => {
    for (const customer of customers) {
      const recipient = campaign.channel === 'email' ? customer.email : customer.phone;
      const personalizedMsg = campaign.message_template.replace(/\{name\}/g, customer.name.split(' ')[0]);
      insertLog.run(uuidv4(), userId, campaign.id, customer.id, campaign.channel, recipient, personalizedMsg);
    }
  });
  insertAllLogs();

  // Dispatch to channel service (async - fire and forget)
  dispatchCampaign(campaign.id, customers, campaign.channel, campaign.message_template);

  res.json({ message: 'Campaign launched', sent_count: customers.length });
});

// GET /campaigns/:id/stream - SSE for live updates
router.get('/:id/stream', (req: Request, res: Response) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  if (!sseClients.has(id)) sseClients.set(id, []);
  sseClients.get(id)!.push(res);

  // Send current state immediately
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (campaign) {
    res.write(`data: ${JSON.stringify(campaign)}\n\n`);
  }

  req.on('close', () => {
    const clients = sseClients.get(id) || [];
    const idx = clients.indexOf(res);
    if (idx > -1) clients.splice(idx, 1);
  });
});

export default router;
