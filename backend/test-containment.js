// backend/test-containment.js
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL.replace('&channel_binding=require','').replace('?channel_binding=require',''),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const r = await client.query(`
    SELECT m.id as scooter, ST_AsText(m.ubicacion) as pos, z.nombre as zona, z.tipo
    FROM monopatines m
    LEFT JOIN zonas_geocercas z ON ST_Contains(z.poligono, m.ubicacion)
    ORDER BY m.id, z.tipo;
  `);
  console.table(r.rows);
  await client.end();
}

main();

