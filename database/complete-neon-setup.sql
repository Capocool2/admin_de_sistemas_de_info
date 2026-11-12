-- database/complete-neon-setup.sql
-- ============================================================================
-- PROYECTO SAME: SISTEMA DE ALQUILER DE MONOPATINES ELÉCTRICOS
-- CONFIGURACIÓN, REPARACIÓN Y DATOS SEMILLA INTEGRALES PARA NEON POSTGRESQL + POSTGIS
-- Gran Malecón del Río - Barranquilla, Colombia
-- ============================================================================

-- 1. EXTENSIÓN ESPACIAL POSTGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. TABLA: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo VARCHAR(150) NOT NULL,
    documento_identidad VARCHAR(20) NOT NULL UNIQUE,
    correo VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'bloqueado')),
    token_pago VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: monopatines
CREATE TABLE IF NOT EXISTS monopatines (
    id VARCHAR(50) PRIMARY KEY,
    numero_serie VARCHAR(100) NOT NULL UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'en uso', 'mantenimiento', 'bloqueado')),
    nivel_bateria INT NOT NULL DEFAULT 100 CHECK (nivel_bateria BETWEEN 0 AND 100),
    velocidad_actual NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    ubicacion GEOMETRY(Point, 4326),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA: zonas_geocercas
CREATE TABLE IF NOT EXISTS zonas_geocercas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('normal', 'peatonal', 'parqueo', 'prohibida')),
    limite_velocidad INT NOT NULL DEFAULT 20,
    tarifa_minuto NUMERIC(10,2) NOT NULL DEFAULT 500.00,
    poligono GEOMETRY(Polygon, 4326) NOT NULL
);

-- 5. TABLA: viajes
CREATE TABLE IF NOT EXISTS viajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    monopatin_id VARCHAR(50) NOT NULL REFERENCES monopatines(id) ON DELETE RESTRICT,
    inicio_viaje TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fin_viaje TIMESTAMP WITH TIME ZONE,
    duracion_minutos INT,
    costo_total NUMERIC(10,2),
    foto_evidencia_url TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'cancelado'))
);

-- 6. TABLA: pagos
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viaje_id UUID NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    monto NUMERIC(10,2) NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('aprobado', 'pendiente', 'rechazado')),
    referencia_transaccion VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA: alertas
CREATE TABLE IF NOT EXISTS alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monopatin_id VARCHAR(50) NOT NULL REFERENCES monopatines(id) ON DELETE CASCADE,
    tipo_alerta VARCHAR(30) NOT NULL,
    ubicacion GEOMETRY(Point, 4326),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'atendida')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. ÍNDICES ESPACIALES Y DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_monopatines_ubicacion ON monopatines USING GIST(ubicacion);
CREATE INDEX IF NOT EXISTS idx_zonas_geocercas_poligono ON zonas_geocercas USING GIST(poligono);
CREATE INDEX IF NOT EXISTS idx_alertas_ubicacion ON alertas USING GIST(ubicacion);
CREATE INDEX IF NOT EXISTS idx_viajes_monopatin ON viajes(monopatin_id);
CREATE INDEX IF NOT EXISTS idx_viajes_usuario_activo ON viajes(usuario_id) WHERE estado = 'activo';

-- ============================================================================
-- 9. RESETEO LIMPIO DE HISTORIAL VOLÁTIL (VIAJES, PAGOS, ALERTAS)
-- ============================================================================
TRUNCATE TABLE pagos, viajes, alertas CASCADE;

-- ============================================================================
-- 10. DATOS SEMILLA: USUARIOS DE PRUEBA
-- ============================================================================
INSERT INTO usuarios (id, nombre_completo, documento_identidad, correo, telefono, estado, token_pago)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Carlos Arturo Mendoza', 'CC-1042789123', 'carlos.mendoza@same.com.co', '+573001234567', 'activo', 'tok_wompi_visa_test_4242'),
    ('b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'María Camila Gómez', 'CC-1045987654', 'maria.gomez@same.com.co', '+573109876543', 'activo', 'tok_wompi_mc_test_5555'),
    ('c2ddbc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Andrés Felipe Torres', 'CC-1047123987', 'andres.torres@same.com.co', '+573204567890', 'activo', 'tok_wompi_visa_test_4000')
ON CONFLICT (id) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    documento_identidad = EXCLUDED.documento_identidad,
    correo = EXCLUDED.correo,
    telefono = EXCLUDED.telefono,
    estado = EXCLUDED.estado,
    token_pago = EXCLUDED.token_pago;

-- ============================================================================
-- 11. DATOS SEMILLA: GEOCERCAS EN FRANJA PAVIMENTADA DEL GRAN MALECÓN
-- ============================================================================
DELETE FROM zonas_geocercas;

-- A. Estación P1: Puerta de Oro
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Estación de Parqueo Puerta de Oro (P1)',
    'parqueo',
    10,
    500.00,
    ST_GeomFromText('POLYGON((-74.7960 11.0180, -74.7950 11.0180, -74.7950 11.0195, -74.7960 11.0195, -74.7960 11.0180))', 4326)
);

-- B. Estación P2: Caimán del Río
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Estación de Parqueo Caimán del Río (P2)',
    'parqueo',
    10,
    500.00,
    ST_GeomFromText('POLYGON((-74.7930 11.0145, -74.7920 11.0145, -74.7920 11.0155, -74.7930 11.0155, -74.7930 11.0145))', 4326)
);

-- C. Estación P3: Manglar / Plaza de Luces
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Estación de Parqueo Manglar (P3)',
    'parqueo',
    10,
    500.00,
    ST_GeomFromText('POLYGON((-74.7945 11.0160, -74.7935 11.0160, -74.7935 11.0170, -74.7945 11.0170, -74.7945 11.0160))', 4326)
);

-- D. Paseo Peatonal Caimán del Río (Regulación Automática 10 km/h)
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Paseo Peatonal Caimán del Río (Máx 10 km/h)',
    'peatonal',
    10,
    500.00,
    ST_GeomFromText('POLYGON((-74.7945 11.0170, -74.7925 11.0145, -74.7915 11.0152, -74.7935 11.0177, -74.7945 11.0170))', 4326)
);

-- E. Ciclorruta Avenida del Río (Zona Normal - 20 km/h)
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Ciclorruta Avenida del Río (Gran Malecón)',
    'normal',
    20,
    500.00,
    ST_GeomFromText('POLYGON((-74.7975 11.0170, -74.7940 11.0210, -74.7890 11.0140, -74.7935 11.0120, -74.7975 11.0170))', 4326)
);

-- ============================================================================
-- 12. DATOS SEMILLA: FLOTA DE MONOPATINES ESTRATÉGICAMENTE UBICADOS
-- ============================================================================
DELETE FROM monopatines;

INSERT INTO monopatines (id, numero_serie, estado, nivel_bateria, velocidad_actual, ubicacion, updated_at)
VALUES
    -- Monopatín principal del simulador en Estación P1 (Puerta de Oro)
    ('SCOOTER-01', 'SN-SAME-2026-001', 'disponible', 95, 0.00, ST_SetSRID(ST_MakePoint(-74.7952, 11.0182), 4326), NOW()),
    
    -- Monopatín en Sector Gastronómico (Caimán del Río)
    ('SCOOTER-02', 'SN-SAME-2026-002', 'disponible', 88, 0.00, ST_SetSRID(ST_MakePoint(-74.7935, 11.0158), 4326), NOW()),
    
    -- Monopatín en Estación P2 (Caimán del Río)
    ('SCOOTER-03', 'SN-SAME-2026-003', 'disponible', 92, 0.00, ST_SetSRID(ST_MakePoint(-74.7925, 11.0150), 4326), NOW()),
    
    -- Monopatín en Estación P3 (Manglar / Pabellón de Cristal)
    ('SCOOTER-04', 'SN-SAME-2026-004', 'disponible', 78, 0.00, ST_SetSRID(ST_MakePoint(-74.7940, 11.0165), 4326), NOW()),
    
    -- Monopatín en Mantenimiento / Batería Baja para probar validación RN-04 (< 20%)
    ('SCOOTER-05', 'SN-SAME-2026-005', 'mantenimiento', 14, 0.00, ST_SetSRID(ST_MakePoint(-74.7955, 11.0185), 4326), NOW());

-- ============================================================================
-- 13. CONSULTAS DE VALIDACIÓN Y VERIFICACIÓN DE INTEGRIDAD
-- ============================================================================
SELECT 'POSTGIS EXTENSION' as modulo, PostGIS_Version() as detalle;
SELECT 'USUARIOS ACTIVOS' as modulo, count(*)::text as detalle FROM usuarios WHERE estado = 'activo';
SELECT 'FLOTA TOTAL' as modulo, count(*)::text as detalle FROM monopatines;
SELECT 'GEOCERCAS' as modulo, count(*)::text as detalle FROM zonas_geocercas;

