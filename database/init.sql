-- database/init.sql
-- ============================================================================
-- PROYECTO SAME: Sistema de Alquiler de Monopatines Eléctricos
-- Ubicación: Gran Malecón del Río, Barranquilla, Colombia
-- Motor: PostgreSQL 16+ con Extensión Espacial PostGIS (Neon Tech)
-- ============================================================================

-- 1. ACTIVACIÓN DE EXTENSIONES ESPACIALES Y CRIPTOGRÁFICAS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. LIMPIEZA DE TABLAS PREVIAS (Para ejecuciones idempotentes)
DROP TABLE IF EXISTS alertas CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS viajes CASCADE;
DROP TABLE IF EXISTS zonas_geocercas CASCADE;
DROP TABLE IF EXISTS monopatines CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================================================
-- 3. DEFINICIÓN DE TABLAS (DDL)
-- ============================================================================

-- TABLA: usuarios
-- Gestiona clientes y perfiles autorizados con token de pago asociado
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo VARCHAR(150) NOT NULL,
    documento_identidad VARCHAR(20) NOT NULL UNIQUE,
    correo VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'bloqueado')),
    token_pago VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- TABLA: monopatines
-- Flota de vehículos con telemetría GPS, batería y estado operativo
CREATE TABLE monopatines (
    id VARCHAR(50) PRIMARY KEY, -- Ej: 'SCOOTER-01'
    numero_serie VARCHAR(100) NOT NULL UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'en uso', 'mantenimiento', 'bloqueado')),
    nivel_bateria INT NOT NULL DEFAULT 100 CHECK (nivel_bateria BETWEEN 0 AND 100),
    velocidad_actual NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    ubicacion geometry(Point, 4326),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- TABLA: zonas_geocercas
-- Polígonos espaciales del Gran Malecón: ciclorruta, zonas peatonales y parqueo
CREATE TABLE zonas_geocercas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('normal', 'peatonal', 'parqueo', 'prohibida')),
    limite_velocidad INT NOT NULL DEFAULT 20, -- En km/h
    tarifa_minuto NUMERIC(10,2) NOT NULL DEFAULT 500.00, -- En COP
    poligono geometry(Polygon, 4326) NOT NULL
);

-- TABLA: viajes
-- Registro de alquileres iniciados por escaneo QR y finalizados con foto y geocerca
CREATE TABLE viajes (
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

-- TABLA: pagos
-- Registro de transacciones procesadas con la pasarela financiera
CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viaje_id UUID NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    monto NUMERIC(10,2) NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('aprobado', 'pendiente', 'rechazado')),
    referencia_transaccion VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- TABLA: alertas
-- Registro de eventos críticos e incidentes para vigilancia y logística
CREATE TABLE alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monopatin_id VARCHAR(50) NOT NULL REFERENCES monopatines(id) ON DELETE CASCADE,
    tipo_alerta VARCHAR(30) NOT NULL CHECK (tipo_alerta IN ('bateria_baja', 'caida', 'robo', 'fuera_perimetro')),
    ubicacion geometry(Point, 4326),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'atendida')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- 4. ÍNDICES ESPACIALES Y DE CONSULTA (R-TREE / GiST)
-- ============================================================================
CREATE INDEX idx_monopatines_ubicacion ON monopatines USING GIST (ubicacion);
CREATE INDEX idx_zonas_geocercas_poligono ON zonas_geocercas USING GIST (poligono);
CREATE INDEX idx_alertas_ubicacion ON alertas USING GIST (ubicacion);
CREATE INDEX idx_viajes_usuario_activo ON viajes (usuario_id) WHERE estado = 'activo';
CREATE INDEX idx_viajes_monopatin ON viajes (monopatin_id);

-- ============================================================================
-- 5. DATOS SEMILLA (SEEDS) - GRAN MALECÓN DEL RÍO, BARRANQUILLA
-- ============================================================================

-- A. Usuario de prueba con tarjeta / token activo
INSERT INTO usuarios (
    id, nombre_completo, documento_identidad, correo, telefono, estado, token_pago
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Carlos Arturo Mendoza',
    '1045678901',
    'carlos.mendoza@same.com.co',
    '+573001234567',
    'activo',
    'tok_visa_4242_sandbox_active'
);

-- B. Zonas Geográficas (Polígonos PostGIS SRID 4326)
-- Eje pavimentado del Gran Malecón de Barranquilla (Avenida del Río entre Puerta de Oro y Caimán del Río)

-- B1. Zona Normal (Ciclorruta Avenida del Río - Máx 20 km/h)
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Ciclorruta Avenida del Río (Gran Malecón)',
    'normal',
    20,
    500.00,
    ST_GeomFromText(
        'POLYGON((
            -74.7975 11.0170,
            -74.7940 11.0210,
            -74.7890 11.0140,
            -74.7935 11.0120,
            -74.7975 11.0170
        ))', 4326
    )
);

-- B2. Zona Peatonal (Sector Caimán del Río - Límite estricto 10 km/h)
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Paseo Peatonal Caimán del Río (Máx 10 km/h)',
    'peatonal',
    10,
    500.00,
    ST_GeomFromText(
        'POLYGON((
            -74.7945 11.0170,
            -74.7925 11.0145,
            -74.7915 11.0152,
            -74.7935 11.0177,
            -74.7945 11.0170
        ))', 4326
    )
);

-- B3. Estación de Parqueo Autorizado 1 (Sector Puerta de Oro - P1)
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Estación de Parqueo Puerta de Oro (P1)',
    'parqueo',
    10,
    500.00,
    ST_GeomFromText(
        'POLYGON((
            -74.7960 11.0180,
            -74.7950 11.0180,
            -74.7950 11.0195,
            -74.7960 11.0195,
            -74.7960 11.0180
        ))', 4326
    )
);

-- B4. Estación de Parqueo Autorizado 2 (Sector Caimán del Río - P2)
INSERT INTO zonas_geocercas (nombre, tipo, limite_velocidad, tarifa_minuto, poligono)
VALUES (
    'Estación de Parqueo Caimán del Río (P2)',
    'parqueo',
    10,
    500.00,
    ST_GeomFromText(
        'POLYGON((
            -74.7930 11.0145,
            -74.7920 11.0145,
            -74.7920 11.0155,
            -74.7930 11.0155,
            -74.7930 11.0145
        ))', 4326
    )
);

-- C. Monopatines Iniciales (Flota en Malecón sobre franja de tierra)
INSERT INTO monopatines (
    id, numero_serie, estado, nivel_bateria, velocidad_actual, ubicacion
) VALUES (
    'SCOOTER-01',
    'SN-SAME-2026-001',
    'disponible',
    95,
    0.00,
    ST_SetSRID(ST_MakePoint(-74.7952, 11.0182), 4326)
);

INSERT INTO monopatines (
    id, numero_serie, estado, nivel_bateria, velocidad_actual, ubicacion
) VALUES (
    'SCOOTER-02',
    'SN-SAME-2026-002',
    'disponible',
    88,
    0.00,
    ST_SetSRID(ST_MakePoint(-74.7935, 11.0158), 4326)
);
