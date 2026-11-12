// backend/inspect-details.js
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL.replace('&channel_binding=require', '').replace('?channel_binding=require', ''),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    await client.connect();

    console.log('--- MONOPATINES COLUMNS ---');
    const m = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'monopatines' ORDER BY ordinal_position;`);
    console.table(m.rows);

    console.log('--- PAGOS COLUMNS ---');
    const p = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'pagos' ORDER BY ordinal_position;`);
    console.table(p.rows);

    console.log('--- FOREIGN KEYS & CONSTRAINTS ---');
    const fk = await client.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    console.table(fk.rows);

    console.log('--- INDEXES ---');
    const idx = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.table(idx.rows);
  } finally {
    await client.end();
  }
}

main();

