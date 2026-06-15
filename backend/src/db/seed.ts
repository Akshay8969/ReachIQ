import { v4 as uuidv4 } from 'uuid';
import { getDb } from './database';
import bcrypt from 'bcryptjs';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'];
const CATEGORIES = ['footwear', 'apparel', 'accessories', 'bags', 'jewellery', 'sportswear', 'ethnic_wear', 'western_wear'];
const FIRST_NAMES_F = ['Priya', 'Anjali', 'Sneha', 'Deepa', 'Kavya', 'Meera', 'Pooja', 'Riya', 'Nisha', 'Ananya', 'Divya', 'Sunita', 'Rekha', 'Geeta', 'Swati', 'Tanya', 'Shreya', 'Aisha', 'Farah', 'Zara'];
const FIRST_NAMES_M = ['Rahul', 'Amit', 'Vikram', 'Rohit', 'Suresh', 'Arjun', 'Karan', 'Nikhil', 'Sanjay', 'Vivek', 'Arun', 'Rajesh', 'Deepak', 'Manoj', 'Pranav', 'Siddharth', 'Akash', 'Ravi', 'Mohit', 'Gaurav'];
const LAST_NAMES = ['Sharma', 'Verma', 'Singh', 'Kumar', 'Gupta', 'Patel', 'Mehta', 'Joshi', 'Nair', 'Reddy', 'Iyer', 'Pillai', 'Bose', 'Das', 'Chopra', 'Malhotra', 'Kapoor', 'Bhatia', 'Arora', 'Saxena'];
const TAGS_POOL = ['vip', 'loyal', 'new', 'at_risk', 'high_spender', 'discount_seeker', 'weekend_shopper', 'app_user', 'email_subscriber', 'referral'];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateInPast(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function randomPhone(): string {
  return `+91${rand(7000000000, 9999999999)}`;
}

export async function seed() {
  const db = getDb();

  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (existingCount > 0) {
    console.log(`✓ Database already seeded with ${existingCount} users`);
    return;
  }

  console.log('🌱 Seeding database...');

  const insertUser = db.prepare(`
    INSERT INTO users (id, company_name, email, password_hash, created_at)
    VALUES (@id, @company_name, @email, @password_hash, @created_at)
  `);

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, user_id, name, email, phone, age, gender, city, total_orders, total_spend, last_order_date, tags, created_at)
    VALUES (@id, @user_id, @name, @email, @phone, @age, @gender, @city, @total_orders, @total_spend, @last_order_date, @tags, @created_at)
  `);

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, customer_id, amount, product_category, status, created_at)
    VALUES (@id, @user_id, @customer_id, @amount, @product_category, @status, @created_at)
  `);

  const updateCustomer = db.prepare(`
    UPDATE customers SET total_orders = @total_orders, total_spend = @total_spend, last_order_date = @last_order_date WHERE id = @id
  `);

  const userId = uuidv4();
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash('password123', salt);

  const seedAll = db.transaction(() => {
    // 1. Create a default user
    insertUser.run({
      id: userId,
      company_name: 'ReachIQ Demo',
      email: 'demo@reachiq.com',
      password_hash,
      created_at: new Date().toISOString(),
    });

    const customerIds: string[] = [];

    // Create 500 customers
    for (let i = 0; i < 500; i++) {
      const gender = Math.random() > 0.45 ? 'female' : 'male';
      const firstName = gender === 'female' ? randFrom(FIRST_NAMES_F) : randFrom(FIRST_NAMES_M);
      const lastName = randFrom(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const age = rand(18, 55);
      const city = randFrom(CITIES);
      const createdDaysAgo = rand(30, 730);

      const numTags = rand(0, 3);
      const tags: string[] = [];
      const tagsCopy = [...TAGS_POOL];
      for (let t = 0; t < numTags; t++) {
        const idx = rand(0, tagsCopy.length - 1);
        tags.push(tagsCopy.splice(idx, 1)[0]);
      }

      const id = uuidv4();
      customerIds.push(id);

      insertCustomer.run({
        id,
        user_id: userId,
        name,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(1, 999)}@${randFrom(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'])}`,
        phone: randomPhone(),
        age,
        gender,
        city,
        total_orders: 0,
        total_spend: 0,
        last_order_date: null,
        tags: JSON.stringify(tags),
        created_at: dateInPast(createdDaysAgo),
      });
    }

    // Create 2000 orders
    const statusPool: Array<'completed' | 'pending' | 'cancelled' | 'returned'> = ['completed', 'completed', 'completed', 'completed', 'pending', 'cancelled', 'returned'];
    const customerStats: Record<string, { orders: number; spend: number; lastDate: string }> = {};

    for (let i = 0; i < 2000; i++) {
      const customerId = randFrom(customerIds);
      const daysAgo = rand(1, 365);
      const amount = randFloat(299, 8999);
      const status = randFrom(statusPool);
      const orderDate = dateInPast(daysAgo);

      insertOrder.run({
        id: uuidv4(),
        user_id: userId,
        customer_id: customerId,
        amount,
        product_category: randFrom(CATEGORIES),
        status,
        created_at: orderDate,
      });

      if (!customerStats[customerId]) {
        customerStats[customerId] = { orders: 0, spend: 0, lastDate: orderDate };
      }
      if (status === 'completed') {
        customerStats[customerId].orders++;
        customerStats[customerId].spend += amount;
        if (orderDate > customerStats[customerId].lastDate) {
          customerStats[customerId].lastDate = orderDate;
        }
      }
    }

    // Update customer stats
    for (const [id, stats] of Object.entries(customerStats)) {
      updateCustomer.run({
        id,
        total_orders: stats.orders,
        total_spend: Math.round(stats.spend * 100) / 100,
        last_order_date: stats.lastDate,
      });
    }

    // Seed some initial segments
    const insertSegment = db.prepare(`
      INSERT INTO segments (id, user_id, name, description, filter_sql, customer_count, created_by, created_at)
      VALUES (@id, @user_id, @name, @description, @filter_sql, @customer_count, @created_by, @created_at)
    `);

    const segments = [
      {
        id: uuidv4(),
        name: 'High Spenders',
        description: 'Customers who have spent more than ₹10,000 in total',
        filter_sql: "SELECT * FROM customers WHERE total_spend > 10000",
        created_by: 'manual',
      },
      {
        id: uuidv4(),
        name: 'Lapsed Buyers (90+ days)',
        description: 'Customers who haven\'t purchased in over 90 days',
        filter_sql: "SELECT * FROM customers WHERE last_order_date < date('now', '-90 days') AND total_orders > 0",
        created_by: 'ai',
      },
      {
        id: uuidv4(),
        name: 'New Customers',
        description: 'Customers who joined in the last 30 days',
        filter_sql: "SELECT * FROM customers WHERE created_at > date('now', '-30 days')",
        created_by: 'manual',
      },
      {
        id: uuidv4(),
        name: 'VIP Loyal Shoppers',
        description: 'Customers tagged as VIP or loyal with 3+ orders',
        filter_sql: "SELECT * FROM customers WHERE (tags LIKE '%vip%' OR tags LIKE '%loyal%') AND total_orders >= 3",
        created_by: 'ai',
      },
      {
        id: uuidv4(),
        name: 'Women in Mumbai & Delhi',
        description: 'Female customers in metro cities',
        filter_sql: "SELECT * FROM customers WHERE gender = 'female' AND city IN ('Mumbai', 'Delhi')",
        created_by: 'manual',
      },
    ];

    for (const seg of segments) {
      // For seeding, append user_id filter manually to compute count accurately for this user
      const countQuery = seg.filter_sql.replace('SELECT * FROM customers WHERE ', 'SELECT COUNT(*) as c FROM customers WHERE user_id = ? AND (');
      const count = (db.prepare(countQuery + ')').get(userId) as any).c || 0;
      insertSegment.run({
        ...seg,
        user_id: userId,
        customer_count: count,
        created_at: dateInPast(rand(1, 20)),
      });
    }
  });

  // seedAll is a sync transaction
  seedAll();
  console.log('✅ Seeding complete! 1 User, 500 customers, 2000 orders, 5 segments created.');
}

// Only run if called directly
if (require.main === module) {
  seed().catch(console.error);
}
