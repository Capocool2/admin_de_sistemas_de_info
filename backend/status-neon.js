// backend/status-neon.js
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
    await client.connect();
    console.log('=== ESTADO ACTUAL DE NEON POSTGRESQL ===\n');

    // 1. Monopatines
    const scooters = await client.query(`
      SELECT id, numero_serie, estado, nivel_bateria, velocidad_actual, ST_AsText(ubicacion) as posicion, updated_at
      FROM monopatines ORDER BY id;
    `);
    console.log('📌 MONOPATINES:');
    console.table(scooters.rows);

    // 2. Geocercas
    const geofences = await client.query(`
      SELECT id, nombre, tipo, limite_velocidad, tarifa_minuto, ST_AsText(poligono) as poligono_wkt
      FROM zonas_geocercas ORDER BY id;
    `);
    console.log('\n📌 GEOCERCAS Y ESTACIONES:');
    console.table(geofences.rows.map(g => ({
      id: g.id,
      nombre: g.nombre,
      tipo: g.tipo,
      limite_vel: g.limite_velocidad,
      tarifa: g.tarifa_minuto
    })));

    // 3. Usuarios
    const users = await client.query(`
      SELECT id, nombre_completo, correo, estado FROM usuarios;
    `);
    console.log('\n📌 USUARIOS:');
    console.table(users.rows);

    // 4. Viajes
    const trips = await client.query(`
      SELECT id, usuario_id, monopatin_id, estado, inicio_viaje, fin_viaje, duracion_minutos, costo_total
      FROM viajes ORDER BY inicio_viaje DESC LIMIT 5;
    `);
    console.log('\n📌 ÚLTIMOS VIAJES:');
    console.table(trips.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
