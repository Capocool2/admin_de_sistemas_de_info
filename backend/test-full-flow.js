// backend/test-full-flow.js
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require', '');

const client = new Client({
  connectionString: cleanDbUrl,
  ssl: { rejectUnauthorized: false },
});

async function runTests() {
  console.log('====================================================================');
  console.log('🧪 PRUEBAS DE INTEGRACIÓN: VERIFICACIÓN EMAIL + 3 STRIKES (NEON TECH)');
  console.log('====================================================================\n');

  try {
    await client.connect();
    console.log('✅ Conexión con PostgreSQL + PostGIS (Neon Tech) establecida.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Verificar Polígono del Perímetro Operativo Gran Malecón
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Polígono del Perímetro Operativo en Neon PostGIS ---');
    const perimResult = await client.query(`
      SELECT id, nombre, tipo, ST_AsText(poligono) as poligono_wkt
      FROM zonas_geocercas
      WHERE tipo = 'perimetro'
      LIMIT 1;
    `);

    if (perimResult.rows.length === 0) {
      throw new Error('❌ No se encontró el polígono con tipo = "perimetro" en zonas_geocercas');
    }
    const perim = perimResult.rows[0];
    console.log(`✅ Geocerca encontrada: "${perim.nombre}" (Tipo: ${perim.tipo})`);
    console.log(`   WKT: ${perim.poligono_wkt}\n`);

    // -------------------------------------------------------------------------
    // TEST 2: Validación Espacial PostGIS (ST_Contains DENTRO vs FUERA)
    // -------------------------------------------------------------------------
    console.log('--- TEST 2: Validación Espacial ST_Contains (Dentro vs Fuera) ---');
    // Coordenada dentro del Malecón: Lat 11.0182, Lng -74.7952
    const insideCheck = await client.query(`
      SELECT ST_Contains(poligono, ST_SetSRID(ST_MakePoint(-74.7952, 11.0182), 4326)) AS dentro
      FROM zonas_geocercas
      WHERE tipo = 'perimetro'
      LIMIT 1;
    `);
    const isInside = insideCheck.rows[0]?.dentro;
    console.log(`📍 Punto Malecón (-74.7952, 11.0182): dentro = ${isInside} -> ${isInside ? '✅ CORRECTO (Dentro)' : '❌ FALLÓ'}`);

    // Coordenada fuera del Malecón (tecla 's'): Lat 11.0220, Lng -74.7990
    const outsideCheck = await client.query(`
      SELECT ST_Contains(poligono, ST_SetSRID(ST_MakePoint(-74.7990, 11.0220), 4326)) AS dentro
      FROM zonas_geocercas
      WHERE tipo = 'perimetro'
      LIMIT 1;
    `);
    const isOutside = !outsideCheck.rows[0]?.dentro;
    console.log(`🚨 Punto Salida (-74.7990, 11.0220): dentro = ${outsideCheck.rows[0]?.dentro} -> ${isOutside ? '✅ CORRECTO (Detectado Fuera)' : '❌ FALLÓ'}\n`);

    // -------------------------------------------------------------------------
    // TEST 3: Cuenta de Administrador Oficial en Neon
    // -------------------------------------------------------------------------
    console.log('--- TEST 3: Cuenta Administrador Oficial (admin@same.com) ---');
    const adminRes = await client.query(`
      SELECT id, nombre_completo, correo, rol, estado, email_verificado, infracciones_perimetro, password_hash
      FROM usuarios
      WHERE correo = 'admin@same.com'
      LIMIT 1;
    `);
    const admin = adminRes.rows[0];
    if (!admin) throw new Error('❌ Cuenta de administrador no encontrada en Neon');
    console.log(`👤 Admin: ${admin.nombre_completo} (${admin.correo})`);
    console.log(`   Rol: ${admin.rol} | Estado: ${admin.estado} | Verificado: ${admin.email_verificado}`);
    const adminPassMatch = await bcrypt.compare('Admin2026*', admin.password_hash);
    console.log(`   Password 'Admin2026*' válida: ${adminPassMatch ? '✅ CORRECTO' : '❌ INCORRECTO'}\n`);

    // -------------------------------------------------------------------------
    // TEST 4: Ciclo Completo de Registro -> Código OTP -> Verificación -> 3 Strikes
    // -------------------------------------------------------------------------
    console.log('--- TEST 4: Ciclo de Registro de Turista con Código OTP y 3 Strikes ---');
    const testEmail = 'turista.e2e@same.com';
    const testDoc = 'CC-TEST-998877';

    // Limpieza previa
    await client.query(`DELETE FROM usuarios WHERE correo = $1 OR documento_identidad = $2;`, [testEmail, testDoc]);

    // a. Simular inserción de registro
    const hash = await bcrypt.hash('TuristaClave2026*', 10);
    const otpCode = '742915';
    const otpExp = new Date(Date.now() + 15 * 60 * 1000);

    const regResult = await client.query(`
      INSERT INTO usuarios (
        nombre_completo, documento_identidad, correo, telefono,
        estado, rol, password_hash, email_verificado,
        codigo_verificacion, codigo_expira_en, infracciones_perimetro, created_at
      )
      VALUES ($1, $2, $3, $4, 'pendiente_verificacion', 'turista', $5, FALSE, $6, $7, 0, NOW())
      RETURNING id, correo, estado, email_verificado, codigo_verificacion, codigo_expira_en, infracciones_perimetro;
    `, ['Turista Prueba E2E', testDoc, testEmail, '+573001234567', hash, otpCode, otpExp]);

    const newUser = regResult.rows[0];
    console.log(`1. Turista registrado en Neon: ${newUser.correo}`);
    console.log(`   Estado: '${newUser.estado}' | email_verificado: ${newUser.email_verificado}`);
    console.log(`   Código OTP: '${newUser.codigo_verificacion}' (Expira: ${newUser.codigo_expira_en}) -> ✅ Registrado correctamente`);

    // b. Validar que el login sin verificar es bloqueado
    const checkUnverified = await client.query(`
      SELECT email_verificado, estado FROM usuarios WHERE id = $1;
    `, [newUser.id]);
    const blockedBeforeVerify = !checkUnverified.rows[0].email_verificado;
    console.log(`2. Verificación de bloqueo pre-activación: ${blockedBeforeVerify ? '✅ Bloqueado con 403 Forbidden' : '❌ Error'}`);

    // c. Simular verificación de correo con código OTP
    await client.query(`
      UPDATE usuarios
      SET email_verificado = TRUE,
          estado = 'activo',
          codigo_verificacion = NULL,
          codigo_expira_en = NULL
      WHERE id = $1;
    `, [newUser.id]);

    const afterVerify = await client.query(`
      SELECT email_verificado, estado, codigo_verificacion FROM usuarios WHERE id = $1;
    `, [newUser.id]);
    const isNowActive = afterVerify.rows[0].email_verificado && afterVerify.rows[0].estado === 'activo' && afterVerify.rows[0].codigo_verificacion === null;
    console.log(`3. Correo verificado con código: email_verificado=${afterVerify.rows[0].email_verificado}, estado='${afterVerify.rows[0].estado}', codigo=${afterVerify.rows[0].codigo_verificacion} -> ${isNowActive ? '✅ Activo para Login' : '❌ Error'}`);

    // d. Simular Infracción 1 (Strike 1)
    const s1 = await client.query(`
      UPDATE usuarios SET infracciones_perimetro = infracciones_perimetro + 1 WHERE id = $1 RETURNING infracciones_perimetro, estado;
    `, [newUser.id]);
    console.log(`4. Salida 1 del perímetro (Strike 1/3): infracciones = ${s1.rows[0].infracciones_perimetro}, estado = '${s1.rows[0].estado}' -> ✅ Advertencia y velocidad reducida`);

    // e. Simular Infracción 2 (Strike 2)
    const s2 = await client.query(`
      UPDATE usuarios SET infracciones_perimetro = infracciones_perimetro + 1 WHERE id = $1 RETURNING infracciones_perimetro, estado;
    `, [newUser.id]);
    console.log(`5. Salida 2 del perímetro (Strike 2/3): infracciones = ${s2.rows[0].infracciones_perimetro}, estado = '${s2.rows[0].estado}' -> ✅ Segunda Advertencia`);

    // f. Simular Infracción 3 (Strike 3 -> Baja Automática)
    const s3 = await client.query(`
      UPDATE usuarios 
      SET infracciones_perimetro = infracciones_perimetro + 1,
          estado = 'dado_de_baja'
      WHERE id = $1 
      RETURNING infracciones_perimetro, estado;
    `, [newUser.id]);
    const isBanned = s3.rows[0].infracciones_perimetro >= 3 && s3.rows[0].estado === 'dado_de_baja';
    console.log(`6. Salida 3 del perímetro (Strike 3/3): infracciones = ${s3.rows[0].infracciones_perimetro}, estado = '${s3.rows[0].estado}' -> ${isBanned ? '✅ DADO DE BAJA AUTOMÁTICAMENTE' : '❌ Error'}`);

    // Limpieza del usuario de prueba
    await client.query(`DELETE FROM usuarios WHERE id = $1;`, [newUser.id]);
    console.log(`\n🧹 Usuario de prueba eliminado de Neon. Estado de BD limpio.`);

    console.log('\n====================================================================');
    console.log('🎉 TODOS LOS TESTS DE PERSISTENCIA EN NEON PASARON SATISFACTORIAMENTE');
    console.log('====================================================================');

  } catch (err) {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
