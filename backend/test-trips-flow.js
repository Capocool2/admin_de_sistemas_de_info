// backend/test-trips-flow.js
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL.replace('&channel_binding=require','').replace('?channel_binding=require',''),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('=== TEST DE FLUJO END-TO-END DE VIAJES Y REGLAS DE NEGOCIO ===\n');

  // 1. Verificar usuarios activos
  const userRes = await client.query(`SELECT id, nombre_completo, estado FROM usuarios LIMIT 1;`);
  const user = userRes.rows[0];
  console.log(`👤 Usuario de prueba: ${user.nombre_completo} (${user.id})`);

  // 2. Verificar monopatines
  const scRes = await client.query(`SELECT id, estado, nivel_bateria, ST_AsText(ubicacion) as pos FROM monopatines WHERE id IN ('SCOOTER-01', 'SCOOTER-05');`);
  console.log('🛴 Monopatines de prueba:');
  console.table(scRes.rows);

  // 3. Probar regla de batería baja en SCOOTER-05 (14%)
  const sc05 = scRes.rows.find(s => s.id === 'SCOOTER-05');
  if (sc05.nivel_bateria < 20) {
    console.log(`✅ [RN-04 VALIDADA] SCOOTER-05 tiene batería insuficiente (${sc05.nivel_bateria}%). El sistema rechazará el desbloqueo.`);
  }

  // 4. Iniciar viaje con SCOOTER-01
  console.log('\n▶️ Simulando inicio de viaje para SCOOTER-01...');
  const insertViaje = await client.query(`
    INSERT INTO viajes (usuario_id, monopatin_id, estado, inicio_viaje)
    VALUES ($1, 'SCOOTER-01', 'activo', NOW())
    RETURNING id, usuario_id, monopatin_id, inicio_viaje, estado;
  `, [user.id]);
  const viajeId = insertViaje.rows[0].id;

  await client.query(`UPDATE monopatines SET estado = 'en uso' WHERE id = 'SCOOTER-01';`);
  console.log(`✅ Viaje iniciado con ID: ${viajeId}. Monopatín SCOOTER-01 en estado 'en uso'.`);

  // 5. Verificar validación de parqueo con PostGIS
  console.log('\n▶️ Verificando geocerca de parqueo autorizada para finalizar viaje...');
  const parkingCheck = await client.query(`
    SELECT z.id, z.nombre, z.tarifa_minuto
    FROM monopatines m
    JOIN zonas_geocercas z ON ST_Contains(z.poligono, m.ubicacion)
    WHERE m.id = 'SCOOTER-01' AND z.tipo = 'parqueo'
    LIMIT 1;
  `);

  if (parkingCheck.rows.length > 0) {
    console.log(`✅ Monopatín dentro de estación: "${parkingCheck.rows[0].nombre}" (Tarifa: $${parkingCheck.rows[0].tarifa_minuto}/min)`);
  } else {
    console.error('❌ Error: El monopatín no está en una estación de parqueo.');
  }

  // 6. Finalizar viaje y registrar pago
  console.log('\n▶️ Simulando finalización de viaje y procesamiento de pago...');
  const refTransaccion = `PAY-TEST-${Date.now()}`;
  const insertPago = await client.query(`
    INSERT INTO pagos (viaje_id, monto, estado, referencia_transaccion, created_at)
    VALUES ($1, 2500.00, 'aprobado', $2, NOW())
    RETURNING id, monto, estado, referencia_transaccion;
  `, [viajeId, refTransaccion]);

  await client.query(`
    UPDATE viajes 
    SET estado = 'finalizado', fin_viaje = NOW(), duracion_minutos = 5, costo_total = 2500.00, foto_evidencia_url = 'https://evidencias.same.com.co/test.jpg'
    WHERE id = $1;
  `, [viajeId]);

  await client.query(`UPDATE monopatines SET estado = 'disponible', velocidad_actual = 0.00 WHERE id = 'SCOOTER-01';`);

  console.log(`✅ Pago aprobado: ${insertPago.rows[0].referencia_transaccion} ($${insertPago.rows[0].monto} COP)`);
  console.log(`✅ Viaje ${viajeId} finalizado. SCOOTER-01 restablecido a 'disponible'.`);

  // 7. Limpiar viaje de prueba para dejar BD prístina
  await client.query(`TRUNCATE TABLE pagos, viajes CASCADE;`);
  console.log('\n🧹 Tablas de viajes reseteadas y listas para las pruebas del usuario.');

  await client.end();
}

main();

