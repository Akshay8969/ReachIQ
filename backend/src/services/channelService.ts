import { getDb } from '../db/database';
import { sseClients } from '../routes/campaigns';

// Simulates the Channel Service stub as described in the spec:
// 1. CRM calls this with campaign details
// 2. Channel service simulates delivery outcomes asynchronously
// 3. Callbacks update communication_log and aggregate campaign stats

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simulateOutcome(): 'delivered' | 'failed' {
  return Math.random() < 0.85 ? 'delivered' : 'failed';
}

function shouldOpen(channel: string): boolean {
  const rates: Record<string, number> = { whatsapp: 0.75, rcs: 0.65, sms: 0.45, email: 0.30 };
  return Math.random() < (rates[channel] || 0.5);
}

function shouldClick(): boolean {
  return Math.random() < 0.28;
}

function broadcastCampaignUpdate(campaignId: string) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return;

  const clients = sseClients.get(campaignId) || [];
  const payload = `data: ${JSON.stringify(campaign)}\n\n`;
  clients.forEach(client => {
    try { client.write(payload); } catch {}
  });
}

export async function dispatchCampaign(
  campaignId: string,
  customers: any[],
  channel: string,
  messageTemplate: string
) {
  const db = getDb();

  // Process in batches of 10 for realistic simulation
  const batchSize = 10;
  let deliveredTotal = 0;
  let failedTotal = 0;
  let openedTotal = 0;
  let clickedTotal = 0;

  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);

    // Simulate network delay for each batch
    await sleep(800 + Math.random() * 1200);

    for (const customer of batch) {
      const outcome = simulateOutcome();

      // Update communication log
      db.prepare(`
        UPDATE communication_log SET status = ?, updated_at = datetime('now')
        WHERE campaign_id = ? AND customer_id = ?
      `).run(outcome, campaignId, customer.id);

      if (outcome === 'delivered') {
        deliveredTotal++;

        // Simulate open event
        if (shouldOpen(channel)) {
          await sleep(500 + Math.random() * 2000);
          openedTotal++;
          db.prepare(`
            UPDATE communication_log SET status = 'opened', updated_at = datetime('now')
            WHERE campaign_id = ? AND customer_id = ?
          `).run(campaignId, customer.id);

          // Simulate click event
          if (shouldClick()) {
            await sleep(300 + Math.random() * 1000);
            clickedTotal++;
            db.prepare(`
              UPDATE communication_log SET status = 'clicked', updated_at = datetime('now')
              WHERE campaign_id = ? AND customer_id = ?
            `).run(campaignId, customer.id);
          }
        }
      } else {
        failedTotal++;
      }
    }

    // Aggregate stats into campaign after each batch
    db.prepare(`
      UPDATE campaigns SET
        delivered_count = ?,
        failed_count = ?,
        opened_count = ?,
        clicked_count = ?
      WHERE id = ?
    `).run(deliveredTotal, failedTotal, openedTotal, clickedTotal, campaignId);

    // Broadcast update via SSE
    broadcastCampaignUpdate(campaignId);
  }

  // Mark campaign as completed
  db.prepare(`UPDATE campaigns SET status = 'completed' WHERE id = ?`).run(campaignId);
  broadcastCampaignUpdate(campaignId);
}
