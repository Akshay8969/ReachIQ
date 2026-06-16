# ReachIQ — AI-Native Mini CRM for Reaching Shoppers



## 🚀 Live Demo

[https://reachiq-frontend.vercel.app](https://reach-iq-zeta.vercel.app/)


## 📦 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) | SSR + SSE support, great DX |
| Backend | Node.js + Express | Fast, great ecosystem |
| Database | SQLite (better-sqlite3) | Zero-infra, WAL mode, trivially swappable to Postgres |
| AI | Google Gemini 1.5 Flash | Function calling for structured tool use |
| Styling | Vanilla CSS with design tokens | Full control, premium dark-mode |

## 🧠 What's AI-Native Here

AI isn't bolted on — it's woven into every core workflow:

1. **Natural Language → SQL Segments**: "Find women aged 25-35 who haven't purchased in 90 days" → Gemini generates SQLite query → live preview
2. **AI Message Drafting**: Pick channel + goal → Gemini writes channel-appropriate copy with personalisation tokens
3. **Channel Suggestion**: Gemini recommends best channel based on audience + campaign goal


## 🏗️ Architecture

```
Frontend (Next.js)         Backend (Express)          Channel Service (Stub)
┌─────────────────┐        ┌─────────────────┐        ┌──────────────────┐
│  Dashboard       │        │  REST API        │        │  dispatchCampaign│
│  Customers       │◄──────►│  /api/customers  │        │  (async, in-proc)│
│  Segments (AI)   │        │  /api/segments   │        │  • 85% delivered │
│  Campaign Wizard │        │  /api/campaigns  │        │  • 15% failed    │
│  Live Monitor    │◄──SSE──│  /api/ai         │        │  • 60% opened    │
│  AI Chat Panel   │        │                  │        │  • 28% clicked   │
└─────────────────┘        │  SQLite DB        │        └──────────────────┘
                           │  Gemini Agent    │
                           └─────────────────┘
```

## 📐 Scale Assumptions & Tradeoffs

- **SQLite over Postgres**: Zero infra overhead for this scope. Handles hundreds of thousands of rows cleanly with WAL mode. Swappable by changing the ORM adapter in production.
- **Synchronous AI calls**: Kept simple for UX. In production, these would be queued (SQS/Pub-Sub) and streamed.
- **Channel Service in-process**: Per spec. Production would be a separate microservice with retries, dead-letter queues.
- **SSE over WebSockets**: Unidirectional push is all we need for campaign monitoring. WebSockets would be overkill.
- **Multi-Tenant Auth**: Built-in JWT-based authentication allows multiple companies to register and use the platform with strict SQL-level data isolation.

## 🗃️ Data Model

```sql
```sql
users     (id, company_name, email, password_hash, created_at)
customers (id, user_id, name, email, phone, age, gender, city, total_orders, total_spend, last_order_date, tags, created_at)
orders    (id, user_id, customer_id, amount, product_category, status, created_at)
segments  (id, user_id, name, description, filter_sql, customer_count, created_by, created_at)
campaigns (id, user_id, name, segment_id, channel, message_template, status, sent_count, delivered_count, failed_count, opened_count, clicked_count, launched_at)
communication_log (id, user_id, campaign_id, customer_id, channel, recipient, message, status, sent_at, updated_at)
```
```

## 🔄 Channel Service Flow

```
1. CRM calls dispatchCampaign(campaignId, customers, channel, message)
2. Service processes in batches of 10 (simulates network latency)
3. Each message: 85% delivered, 15% failed
4. Delivered messages: 60-75% opened (channel-dependent)
5. Opened messages: 28% clicked
6. After each batch → UPDATE campaigns table → broadcast via SSE
7. Campaign marked 'completed' when all messages processed
```

## 🏃 Running Locally

### Backend
```bash
cd backend
npm install
npm run dev   # starts on http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:3000
```

### Environment Variables

**backend/.env**
```
PORT=3001
GEMINI_API_KEY=your_key_here
DATABASE_PATH=./reachiq.db
FRONTEND_URL=http://localhost:3000
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 📊 Seeded Data

On first run, the backend auto-seeds:
- **500 customers** — realistic Indian fashion brand shoppers (name, age, gender, city, spend history)
- **2,000 orders** — across 8 product categories
- **5 pre-built segments** — High Spenders, Lapsed Buyers, New Customers, VIP Loyal, Women in Metro

## 🤖 AI Agent Tools (Gemini Function Calling)

| Tool | Description |
|---|---|
| `query_customers` | NL → SQL → run → return results |
| `get_campaign_stats` | Retrieve campaign performance data |
| `get_customer_insights` | Aggregate analytics (city, spend, lapse) |
| `draft_campaign_message` | Channel-appropriate copy generation |
| `suggest_channel` | Recommend best channel for audience + goal |
