import { getDb } from '../db/database';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-1.5-flash';

// ─── Core Gemini REST call ────────────────────────────────────────────────────
// AQ. keys are OAuth2 Bearer tokens; standard AIza. keys use ?key= on v1.
async function geminiCall(contents: any[]): Promise<string> {
  const body = {
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const isBearer = GEMINI_API_KEY.startsWith('AQ.');
  const url = isBearer
    ? `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
    : `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isBearer) {
    headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ─── DB Context Builder ───────────────────────────────────────────────────────
function buildDbContext(): string {
  const db = getDb();
  const totals = db.prepare(`
    SELECT COUNT(*) as total_customers,
           ROUND(SUM(total_spend), 0) as total_revenue,
           ROUND(AVG(total_spend), 0) as avg_spend,
           SUM(CASE WHEN last_order_date < date('now', '-90 days') AND total_orders > 0 THEN 1 ELSE 0 END) as lapsed_90d
    FROM customers
  `).get() as any;
  const topCustomers = db.prepare(
    `SELECT name, city, ROUND(total_spend,0) as spend, total_orders FROM customers ORDER BY total_spend DESC LIMIT 5`
  ).all() as any[];
  const topCities = db.prepare(
    `SELECT city, COUNT(*) as count FROM customers GROUP BY city ORDER BY count DESC LIMIT 5`
  ).all() as any[];
  const campaigns = db.prepare(`
    SELECT name, channel, status, sent_count, delivered_count,
      ROUND(CAST(delivered_count AS REAL)/NULLIF(sent_count,0)*100,1) as delivery_rate
    FROM campaigns ORDER BY launched_at DESC LIMIT 5
  `).all() as any[];
  const segments = db.prepare(
    `SELECT name, customer_count FROM segments ORDER BY customer_count DESC LIMIT 5`
  ).all() as any[];

  return [
    `Customers: ${totals?.total_customers} total | Revenue: Rs.${totals?.total_revenue?.toLocaleString()} | Avg spend: Rs.${totals?.avg_spend} | Lapsed 90d: ${totals?.lapsed_90d}`,
    `Top spenders: ${topCustomers.map((c: any) => `${c.name} (${c.city}, Rs.${c.spend}, ${c.total_orders} orders)`).join('; ')}`,
    `Top cities: ${topCities.map((c: any) => `${c.city} (${c.count})`).join(', ')}`,
    `Campaigns: ${campaigns.length ? campaigns.map((c: any) => `"${c.name}" via ${c.channel} - ${c.status}, sent ${c.sent_count}, ${c.delivery_rate}% delivered`).join('; ') : 'none yet'}`,
    `Segments: ${segments.length ? segments.map((s: any) => `"${s.name}" (${s.customer_count} customers)`).join('; ') : 'none yet'}`,
  ].join('\n');
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export async function chat(
  userMessage: string,
  history: ChatMessage[] = []
): Promise<{ reply: string }> {
  try {
    const dbContext = buildDbContext();
    const contents = [
      { role: 'user', parts: [{ text: `You are ReachIQ's AI assistant for StyleHub, an Indian fashion brand CRM. Be concise, warm, use bullet points.\n\nLive data:\n${dbContext}\n\nConfirm ready.` }] },
      { role: 'model', parts: [{ text: 'Ready! I have the live data loaded. What would you like to know?' }] },
      ...history.slice(-6),
      { role: 'user', parts: [{ text: userMessage }] },
    ];
    const reply = await geminiCall(contents);
    return { reply };
  } catch (e: any) {
    console.error('chat error:', e.message);
    throw new Error(`AI error: ${e.message}`);
  }
}

// ─── Natural Language → SQL Segment ──────────────────────────────────────────
export async function naturalLanguageToSegment(description: string): Promise<{
  sql: string;
  explanation: string;
  customer_count: number;
  preview: any[];
}> {
  const prompt = `You are a SQL expert. Convert the following natural language description into a SQLite SELECT query.

Database schema:
- customers: id TEXT, name TEXT, email TEXT, phone TEXT, age INTEGER, gender TEXT ('male'|'female'|'other'), city TEXT, total_orders INTEGER, total_spend REAL, last_order_date TEXT (YYYY-MM-DD), tags TEXT (JSON array like ["vip","loyal"]), created_at TEXT

Rules:
- Always start with: SELECT * FROM customers
- Use SQLite date syntax: date('now', '-90 days')
- For tags search: tags LIKE '%vip%'
- Return ONLY the raw SQL query, no markdown, no backticks, no explanation

Description: "${description}"`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  let sql: string;
  try {
    const raw = await geminiCall(contents);
    sql = raw
      .replace(/^```sql\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/;$/, '')
      .trim();
    if (!sql.toLowerCase().startsWith('select')) throw new Error('Invalid SQL generated');
  } catch (e: any) {
    console.error('naturalLanguageToSegment Gemini error:', e.message);
    sql = buildFallbackSql(description);
  }

  const db = getDb();
  let customer_count = 0;
  let preview: any[] = [];

  try {
    const limitedSql = sql.toLowerCase().includes('limit') ? sql : `${sql} LIMIT 5`;
    preview = db.prepare(limitedSql).all();
    const countSql = sql.replace(/SELECT \*/i, 'SELECT COUNT(*) as c').replace(/LIMIT \d+/i, '');
    const countResult = db.prepare(countSql).get() as { c: number };
    customer_count = countResult?.c || 0;
  } catch {
    sql = buildFallbackSql(description);
    try {
      preview = db.prepare(`${sql} LIMIT 5`).all();
      const countResult = db.prepare(sql.replace(/SELECT \*/i, 'SELECT COUNT(*) as c')).get() as { c: number };
      customer_count = countResult?.c || 0;
    } catch {
      throw new Error(`Could not build a valid SQL query for: "${description}"`);
    }
  }

  return { sql, explanation: description, customer_count, preview };
}

// ─── Fallback SQL Builder ─────────────────────────────────────────────────────
function buildFallbackSql(description: string): string {
  const d = description.toLowerCase();
  const conditions: string[] = [];

  if (d.includes('women') || d.includes('female')) conditions.push("gender = 'female'");
  else if (d.includes('men') || d.includes('male')) conditions.push("gender = 'male'");

  const cityMatch = d.match(/\b(mumbai|delhi|bangalore|hyderabad|chennai|pune|kolkata|jaipur|ahmedabad|surat)\b/);
  if (cityMatch) conditions.push(`city = '${cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1)}'`);

  // Spend
  const spendBetweenMatch = d.match(/between\s*[₹rs\s]*(\d+)\s*(?:to|and|-)\s*[₹rs\s]*(\d+)/i);
  const spendOverMatch = d.match(/spent?\s+(?:more than|over|above|>)\s*[₹rs\s]*(\d+)/i);
  const spendUnderMatch = d.match(/spent?\s+(?:less than|under|below|<)\s*[₹rs\s]*(\d+)/i);

  if (spendBetweenMatch) {
    conditions.push(`total_spend >= ${spendBetweenMatch[1]} AND total_spend <= ${spendBetweenMatch[2]}`);
  } else if (spendOverMatch) {
    conditions.push(`total_spend > ${spendOverMatch[1]}`);
  } else if (spendUnderMatch) {
    conditions.push(`total_spend < ${spendUnderMatch[1]}`);
  }

  // Age
  const ageMatch = d.match(/aged?\s*(\d+)\s*(?:to|-|and)\s*(\d+)/i);
  if (ageMatch) conditions.push(`age >= ${ageMatch[1]} AND age <= ${ageMatch[2]}`);

  const daysMatch = d.match(/(\d+)\s*days/i);
  if (daysMatch && (d.includes("haven't") || d.includes('not bought') || d.includes('inactive') || d.includes('lapsed'))) {
    conditions.push(`last_order_date < date('now', '-${daysMatch[1]} days')`);
  }

  if (d.includes('vip') || d.includes('loyal')) conditions.push("tags LIKE '%vip%'");
  if (d.includes('new') && d.includes('month')) conditions.push("created_at > date('now', '-30 days')");

  return conditions.length > 0
    ? `SELECT * FROM customers WHERE ${conditions.join(' AND ')}`
    : `SELECT * FROM customers WHERE total_spend > 1000`;
}

// ─── Message Drafting ─────────────────────────────────────────────────────────
export async function draftMessage(
  segmentDescription: string,
  channel: string,
  campaignGoal: string
): Promise<{ message: string; subject?: string }> {
  const channelGuide: Record<string, string> = {
    whatsapp: 'casual, conversational, emoji-rich, max 160 chars, one clear CTA button. Use {name} for personalisation.',
    sms: 'ultra-brief, max 140 chars, start with brand name "StyleHub:", one clear action. Use {name}.',
    email: 'subject line + body. Professional yet warm, 2-3 short paragraphs, clear CTA button. Format strictly as:\nSubject: [your subject line]\n\n[email body]',
    rcs: 'rich and visually engaging, max 250 chars, include a descriptive action button. Use {name}.',
  };

  const prompt = `You are a marketing copywriter for StyleHub, an Indian fashion brand (think Myntra / Nykaa Fashion vibes).

Write a ${channel.toUpperCase()} marketing message with these details:
- Target audience: ${segmentDescription}
- Campaign goal: ${campaignGoal}
- Channel format: ${channelGuide[channel] || channelGuide.whatsapp}
- Use {name} where you want to personalise with the customer's first name
- Make it warm, culturally relevant for Indian shoppers, and compelling
- Be creative and specific to the goal — do NOT write a generic message

${channel === 'email' ? 'Format:\nSubject: [subject line]\n\n[email body text]' : 'Return ONLY the message text, nothing else. No labels, no explanations.'}`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  try {
    const text = await geminiCall(contents);
    if (!text || text.trim() === '') throw new Error('Empty response from Gemini');

    if (channel === 'email') {
      const lines = text.split('\n');
      const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'))?.replace(/^subject:\s*/i, '').trim();
      const body = lines.filter(l => !l.toLowerCase().startsWith('subject:')).join('\n').trim();
      return { message: body, subject: subjectLine };
    }
    return { message: text };
  } catch (e: any) {
    console.error('draftMessage Gemini error:', e.message);
    // Context-aware fallbacks (vary by goal)
    const goalSnippet = campaignGoal.toLowerCase();
    const fallbacks: Record<string, string> = {
      whatsapp: `Hey {name}! 👋 StyleHub here — ${goalSnippet}! Explore our latest drops and grab your exclusive deal. Shop now → stylehub.in 🛍️`,
      sms: `StyleHub: Hi {name}! ${campaignGoal} — your exclusive offer is live. Shop now: stylehub.in`,
      email: `Dear {name},\n\nWe have an exciting ${goalSnippet} offer waiting just for you at StyleHub.\n\nDiscover our curated collection and enjoy exclusive deals tailored to your style.\n\nShop Now → stylehub.in\n\nWith love,\nThe StyleHub Team`,
      rcs: `Hi {name}! ✨ StyleHub — ${goalSnippet}! Tap below to claim your exclusive offer before it expires.`,
    };
    return { message: fallbacks[channel] || fallbacks.whatsapp };
  }
}
