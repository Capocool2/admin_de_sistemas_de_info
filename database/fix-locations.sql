-- database/fix-locations.sql
-- ============================================================================
-- PROYECTO SAME: AJUSTE Y REUBICACIÓN GEOGRÁFICA EXACTA
-- Sector: Franja pavimentada del Gran Malecón del Río, Barranquilla
-- Eje: Entre Puerta de Oro y Caimán del Río (Sin invasión sobre el Río Magdalena)
-- ============================================================================

-- 1. Vaciar viajes y pagos anteriores para evitar bloqueos
TRUNCATE TABLE pagos, viajes CASCADE;

-- 2. Limpiar geocercas previas y redefinirlas sobre el eje peatonal de la Avenida del Río
DELETE FROM zonas_geocercas;

-- A. Estación de Parqueo Autorizado 1 (Puerta de Oro - P1)
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

-- B. Estación de Parqueo Autorizado 2 (Caimán del Río - P2)
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

-- C. Geocerca Peatonal (Caimán del Río - Máx 10 km/h)
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

-- D. Zona Normal (Ciclorruta Principal Gran Malecón - Máx 20 km/h)
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

-- 3. Reubicar los monopatines en las nuevas coordenadas sobre tierra firme
-- 'SCOOTER-01': En Estación Puerta de Oro (P1)
INSERT INTO monopatines (id, numero_serie, estado, nivel_bateria, velocidad_actual, ubicacion)
VALUES (
    'SCOOTER-01',
    'SN-SAME-2026-001',
    'disponible',
    95,
    0.00,
    ST_SetSRID(ST_MakePoint(-74.7952, 11.0182), 4326)
)
ON CONFLICT (id) DO UPDATE SET
    estado = 'disponible',
    velocidad_actual = 0.00,
    nivel_bateria = 95,
    ubicacion = ST_SetSRID(ST_MakePoint(-74.7952, 11.0182), 4326),
    updated_at = CURRENT_TIMESTAMP;

-- 'SCOOTER-02': En Sector Gastronómico
INSERT INTO monopatines (id, numero_serie, estado, nivel_bateria, velocidad_actual, ubicacion)
VALUES (
    'SCOOTER-02',
    'SN-SAME-2026-002',
    'disponible',
    88,
    0.00,
    ST_SetSRID(ST_MakePoint(-74.7935, 11.0158), 4326)
)
ON CONFLICT (id) DO UPDATE SET
    estado = 'disponible',
    velocidad_actual = 0.00,
    nivel_bateria = 88,
    ubicacion = ST_SetSRID(ST_MakePoint(-74.7935, 11.0158), 4326),
    updated_at = CURRENT_TIMESTAMP;

-- 4. Confirmación de verificación
SELECT m.id, m.estado, ST_AsText(m.ubicacion) as coordenada_wkt
FROM monopatines m;

