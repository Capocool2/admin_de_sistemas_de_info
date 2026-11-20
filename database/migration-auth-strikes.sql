-- database/migration-auth-strikes.sql
-- ============================================================================
-- PROYECTO SAME: MIGRACIÓN DE VERIFICACIÓN DE CORREO, ROLES Y SISTEMA DE 3 STRIKES
-- Gran Malecón del Río - Barranquilla, Colombia
-- ============================================================================

-- 1. ACTIVACIÓN DE EXTENSIÓN POSTGIS (Por seguridad)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. ACTUALIZACIÓN DE ESTRUCTURA EN TABLA usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'turista';

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS codigo_verificacion VARCHAR(10);

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS codigo_expira_en TIMESTAMP;

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS infracciones_perimetro INT NOT NULL DEFAULT 0;

-- 3. AJUSTE DE TIPO Y RESTRICCIONES CHECK EN usuarios
ALTER TABLE usuarios ALTER COLUMN estado TYPE VARCHAR(30);

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuario_rol;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT chk_usuario_rol CHECK (rol IN ('turista', 'admin'));

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_usuario_estado;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_estado_check;
ALTER TABLE usuarios ADD CONSTRAINT chk_usuario_estado CHECK (estado IN ('pendiente_verificacion', 'activo', 'dado_de_baja', 'bloqueado'));

-- 4. AJUSTE DE RESTRICCIÓN CHECK EN zonas_geocercas PARA PERMITIR tipo = 'perimetro'
ALTER TABLE zonas_geocercas DROP CONSTRAINT IF EXISTS chk_zona_tipo;
ALTER TABLE zonas_geocercas DROP CONSTRAINT IF EXISTS zonas_geocercas_tipo_check;
ALTER TABLE zonas_geocercas ADD CONSTRAINT chk_zona_tipo CHECK (tipo IN ('normal', 'peatonal', 'parqueo', 'prohibida', 'perimetro'));

-- 5. AJUSTE DE RESTRICCIÓN CHECK EN viajes PARA CANCELACIÓN POR INFRACCIÓN
ALTER TABLE viajes DROP CONSTRAINT IF EXISTS chk_viaje_estado;
ALTER TABLE viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;
ALTER TABLE viajes ADD CONSTRAINT chk_viaje_estado CHECK (estado IN ('activo', 'finalizado', 'cancelado', 'cancelado_infraccion'));

-- 6. AJUSTE DE RESTRICCIÓN CHECK EN alertas PARA TIPOS DE STRIKE Y BAJA
ALTER TABLE alertas DROP CONSTRAINT IF EXISTS chk_alerta_tipo;
ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_tipo_alerta_check;
ALTER TABLE alertas ADD CONSTRAINT chk_alerta_tipo CHECK (tipo_alerta IN ('bateria_baja', 'caida', 'robo', 'fuera_perimetro', 'salida_perimetro', 'usuario_dado_de_baja', 'abandono'));

-- 7. CUENTA DE ADMINISTRADOR OFICIAL (Admin2026* - ya verificada y activa)
-- Nota: El rol admin NO cuenta con registro público; se crea exclusivamente vía SQL.
INSERT INTO usuarios (
    id, 
    nombre_completo, 
    documento_identidad, 
    correo, 
    telefono, 
    estado, 
    rol, 
    password_hash, 
    email_verificado,
    codigo_verificacion,
    codigo_expira_en,
    infracciones_perimetro,
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
    TRUE,
    NULL,
    NULL,
    0,
    NOW()
)
ON CONFLICT (correo) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    documento_identidad = EXCLUDED.documento_identidad,
    telefono = EXCLUDED.telefono,
    estado = 'activo',
    rol = 'admin',
    password_hash = '$2a$10$X/FbsuHeIEokAfnZxLJ1Ze5zpo7SOGb3T8.RJ5eqSpDyUy1kCSwAa',
    email_verificado = TRUE,
    codigo_verificacion = NULL,
    codigo_expira_en = NULL,
    infracciones_perimetro = 0;

-- 8. CUENTA DE TURISTA DE PRUEBAS (test@same.com / Turista123* - ya verificada)
INSERT INTO usuarios (
    id, 
    nombre_completo, 
    documento_identidad, 
    correo, 
    telefono, 
    estado, 
    rol, 
    password_hash, 
    email_verificado,
    codigo_verificacion,
    codigo_expira_en,
    infracciones_perimetro,
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
    TRUE,
    NULL,
    NULL,
    0,
    'tok_wompi_visa_test_4242',
    NOW()
)
ON CONFLICT (correo) DO UPDATE SET
    estado = 'activo',
    rol = 'turista',
    password_hash = '$2a$10$PjXrXgBB0E1FeDHEXNIV9.TzGyjU5EvTAPYXWp11XtwMNgapFAZre',
    email_verificado = TRUE,
    codigo_verificacion = NULL,
    codigo_expira_en = NULL,
    infracciones_perimetro = 0;

-- 9. POLÍGONO DE PERÍMETRO OPERATIVO DEL GRAN MALECÓN (PostGIS 4326)
-- Envuelve las estaciones y la franja peatonal y ciclorruta autorizada
DELETE FROM zonas_geocercas 
WHERE tipo = 'perimetro' OR nombre = 'Perímetro Operativo Gran Malecón';

INSERT INTO zonas_geocercas (
    id, 
    nombre, 
    tipo, 
    limite_velocidad, 
    tarifa_minuto, 
    poligono
)
VALUES (
    gen_random_uuid(),
    'Perímetro Operativo Gran Malecón',
    'perimetro',
    20,
    500.00,
    ST_SetSRID(ST_PolygonFromText('POLYGON((-74.7975 11.0135, -74.7905 11.0135, -74.7905 11.0205, -74.7975 11.0205, -74.7975 11.0135))'), 4326)
);

-- 10. CONSULTA DE VERIFICACIÓN
SELECT id, nombre, tipo, ST_AsText(poligono) AS poligono_wkt 
FROM zonas_geocercas 
WHERE tipo = 'perimetro';

SELECT id, nombre_completo, correo, rol, estado, email_verificado, infracciones_perimetro 
FROM usuarios 
ORDER BY rol ASC, correo ASC;
