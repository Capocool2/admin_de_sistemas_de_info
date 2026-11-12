-- database/reset-trips.sql
-- ============================================================================
-- PROYECTO SAME: SCRIPT DE RESETEO Y LIMPIEZA RÁPIDA DE VIAJES
-- Ubicación: Gran Malecón del Río, Barranquilla
-- ============================================================================

-- 1. Vaciar viajes y pagos existentes (elimina bloqueos por viajes activos)
TRUNCATE TABLE pagos, viajes CASCADE;

-- 2. Restablecer el estado y ubicación de los monopatines en tierra firme
UPDATE monopatines 
SET estado = 'disponible',
    velocidad_actual = 0.00,
    nivel_bateria = 100,
    ubicacion = CASE 
        WHEN id = 'SCOOTER-01' THEN ST_SetSRID(ST_MakePoint(-74.7952, 11.0182), 4326)
        ELSE ST_SetSRID(ST_MakePoint(-74.7935, 11.0158), 4326)
    END,
    updated_at = CURRENT_TIMESTAMP;

-- 3. Limpiar alertas de incidentes previas
TRUNCATE TABLE alertas CASCADE;

-- 4. Asegurar que el usuario de prueba esté en estado 'activo'
UPDATE usuarios 
SET estado = 'activo'
WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Confirmación de ejecución
SELECT 'Reset completado exitosamente: Flota disponible y sin viajes activos' AS resultado;

