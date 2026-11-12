// backend/run-sql.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sqlFilePath = process.argv[2];

if (!sqlFilePath) {
  console.error('Uso: node run-sql.js <ruta-al-archivo-sql>');
  process.exit(1);
}

const resolvedPath = path.resolve(__dirname, sqlFilePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`El archivo SQL no existe: ${resolvedPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(resolvedPath, 'utf8');

const rawDbUrl = process.env.DATABASE_URL || '';
const cleanDbUrl = rawDbUrl
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require', '');

const client = new Client({
  connectionString: cleanDbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('Conectando a Neon PostgreSQL...');
    await client.connect();
    console.log('✅ Conexión establecida con éxito.');

    console.log(`Ejecutando script: ${resolvedPath}...`);
    const res = await client.query(sql);
    console.log('✅ Script ejecutado correctamente.');
    if (Array.isArray(res)) {
      res.forEach((r, idx) => {
        if (r.rows && r.rows.length > 0) {
          console.log(`--- Resultado ${idx + 1} (${r.rows.length} filas) ---`);
          console.table(r.rows);
        }
      });
    } else if (res.rows && res.rows.length > 0) {
      console.log(`--- Resultado (${res.rows.length} filas) ---`);
      console.table(res.rows);
    }
  } catch (err) {
    console.error('❌ Error ejecutando SQL en Neon:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Conexión cerrada.');
  }
}

main();

