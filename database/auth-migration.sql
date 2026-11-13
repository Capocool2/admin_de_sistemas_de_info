-- database/auth-migration.sql
-- ============================================================================
-- PROYECTO SAME: MIGRACIÓN DE AUTENTICACIÓN Y CONTROL DE ROLES (RBAC)
-- Gran Malecón del Río - Barranquilla
-- ============================================================================

-- 1. Agregar columnas de autenticación y rol a la tabla usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '$2a$10$PjXrXgBB0E1FeDHEXNIV9.TzGyjU5EvTAPYXWp11XtwMNgapFAZre';

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'turista';

-- 2. Asegurar restricción CHECK para los roles permitidos ('turista', 'admin')
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuario_rol;
ALTER TABLE usuarios ADD CONSTRAINT chk_usuario_rol CHECK (rol IN ('turista', 'admin'));

-- 3. Crear cuenta oficial de Administrador del Sistema
-- Credenciales: admin@same.com / Admin2026*
INSERT INTO usuarios (
    id, 
    nombre_completo, 
    documento_identidad, 
    correo, 
    telefono, 
    estado, 
    rol, 
    password_hash, 
    created_at
)
VALUES (
    'e0a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c',
    'Administrador Operativo Malecón',
    'ADM-SAME-001',
    'admin@same.com',
    '+573009990001',
    'activo',
    'admin',
    '$2a$10$X/FbsuHeIEokAfnZxLJ1Ze5zpo7SOGb3T8.RJ5eqSpDyUy1kCSwAa',
    NOW()
)
ON CONFLICT (correo) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    documento_identidad = EXCLUDED.documento_identidad,
    telefono = EXCLUDED.telefono,
    estado = 'activo',
    rol = 'admin',
    password_hash = '$2a$10$X/FbsuHeIEokAfnZxLJ1Ze5zpo7SOGb3T8.RJ5eqSpDyUy1kCSwAa';

-- 4. Crear o actualizar cuenta de Turista de Pruebas
-- Credenciales: test@same.com / Turista123*
INSERT INTO usuarios (
    id, 
    nombre_completo, 
    documento_identidad, 
    correo, 
    telefono, 
    estado, 
    rol, 
    password_hash, 
    token_pago,
    created_at
)
VALUES (
    'f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'Turista de Pruebas SAME',
    'CC-1042999888',
    'test@same.com',
    '+573007778899',
    'activo',
    'turista',
    '$2a$10$PjXrXgBB0E1FeDHEXNIV9.TzGyjU5EvTAPYXWp11XtwMNgapFAZre',
    'tok_wompi_visa_test_4242',
    NOW()
)
ON CONFLICT (correo) DO UPDATE SET
    estado = 'activo',
    rol = 'turista',
    password_hash = '$2a$10$PjXrXgBB0E1FeDHEXNIV9.TzGyjU5EvTAPYXWp11XtwMNgapFAZre';

-- 5. Actualizar usuarios existentes para que tengan contraseñas y roles válidos
UPDATE usuarios 
SET password_hash = '$2a$10$PjXrXgBB0E1FeDHEXNIV9.TzGyjU5EvTAPYXWp11XtwMNgapFAZre',
    rol = COALESCE(rol, 'turista')
WHERE rol IS NULL OR password_hash = '123456';

-- 6. Verificación de cuentas activas en Neon
SELECT id, nombre_completo, correo, rol, estado, created_at 
FROM usuarios 
ORDER BY rol ASC, correo ASC;
