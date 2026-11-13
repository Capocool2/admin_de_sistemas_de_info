// backend/test-auth-flow.js
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL.replace('&channel_binding=require','').replace('?channel_binding=require',''),
  ssl: { rejectUnauthorized: false }
});

async function testAuth() {
  await client.connect();
  console.log('=== TEST DE AUTENTICACIÓN Y ROLES EN NEON ===\n');

  // 1. Probar login admin
  const adminRes = await client.query(`SELECT id, nombre_completo, correo, rol, password_hash FROM usuarios WHERE correo = 'admin@same.com';`);
  const admin = adminRes.rows[0];
  console.log('Admin encontrado:', admin.correo, 'Rol:', admin.rol);
  const adminValid = await bcrypt.compare('Admin2026*', admin.password_hash);
  console.log('Validación password Admin2026*:', adminValid ? '✅ CORRECTA' : '❌ FALLÓ');

  // 2. Probar login turista test
  const turistaRes = await client.query(`SELECT id, nombre_completo, correo, rol, password_hash FROM usuarios WHERE correo = 'test@same.com';`);
  const turista = turistaRes.rows[0];
  console.log('\nTurista encontrado:', turista.correo, 'Rol:', turista.rol);
  const turistaValid = await bcrypt.compare('Turista123*', turista.password_hash);
  console.log('Validación password Turista123*:', turistaValid ? '✅ CORRECTA' : '❌ FALLÓ');

  // 3. Probar contraseña errónea
  const wrongValid = await bcrypt.compare('PasswordEquivocada', turista.password_hash);
  console.log('Validación password incorrecta rechazada:', !wrongValid ? '✅ CORRECTO' : '❌ ERROR');

  await client.end();
}

testAuth();
