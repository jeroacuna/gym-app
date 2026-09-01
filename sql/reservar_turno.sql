-- =========================================================
-- FUNCIÓN: reservar_turno
-- =========================================================
-- Resuelve "contar cupo + insertar reserva" en una sola operación
-- atómica, usando FOR UPDATE para bloquear la fila del horario
-- mientras se hace la verificación. Así, si dos personas reservan
-- el mismo horario al mismo instante, la segunda espera a que
-- termine la primera antes de contar el cupo — nunca se pasan
-- de la capacidad máxima.
CREATE OR REPLACE FUNCTION reservar_turno(
    p_usuario_id UUID,
    p_horario_id UUID,
    p_fecha DATE
)
RETURNS TABLE(ok BOOLEAN, mensaje TEXT) AS $$
DECLARE
    v_capacidad INTEGER;
    v_ocupados INTEGER;
BEGIN
    -- Bloqueamos la fila de este horario específico hasta que
    -- termine la transacción actual.
    SELECT capacidad_maxima INTO v_capacidad
    FROM horarios
    WHERE id = p_horario_id AND activo = true
    FOR UPDATE;

    IF v_capacidad IS NULL THEN
        RETURN QUERY SELECT false, 'El horario no existe o no está disponible';
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_ocupados
    FROM reservas
    WHERE horario_id = p_horario_id
      AND fecha = p_fecha
      AND estado = 'activa';

    IF v_ocupados >= v_capacidad THEN
        RETURN QUERY SELECT false, 'Ese horario ya está completo';
        RETURN;
    END IF;

    BEGIN
        INSERT INTO reservas (usuario_id, horario_id, fecha)
        VALUES (p_usuario_id, p_horario_id, p_fecha);
    EXCEPTION WHEN unique_violation THEN
        RETURN QUERY SELECT false, 'Ya tenés una reserva para ese horario y fecha';
        RETURN;
    END;

    RETURN QUERY SELECT true, 'Reserva confirmada';
END;
$$ LANGUAGE plpgsql;

-- Le damos permiso al backend (service_role) para poder ejecutar
-- esta función, igual que hicimos con las tablas.
GRANT EXECUTE ON FUNCTION reservar_turno(UUID, UUID, DATE) TO service_role;
