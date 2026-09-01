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
    v_servicio_id UUID;
    v_incluido BOOLEAN;
    v_pagado BOOLEAN;
    v_dias_por_semana INTEGER;
    v_inicio_semana DATE;
    v_fin_semana DATE;
    v_reservas_semana INTEGER;
BEGIN
    -- Bloqueamos la fila de este horario específico hasta que
    -- termine la transacción actual.
    SELECT capacidad_maxima, servicio_id INTO v_capacidad, v_servicio_id
    FROM horarios
    WHERE id = p_horario_id AND activo = true
    FOR UPDATE;

    IF v_capacidad IS NULL THEN
        RETURN QUERY SELECT false, 'El horario no existe o no está disponible';
        RETURN;
    END IF;

    -- Chequeamos que el plan del socio incluya el servicio al que
    -- pertenece este horario (ej: alguien con "Solo Pilates" no
    -- puede reservar un turno de gimnasio), y de paso traemos el
    -- límite de días por semana que tenga configurado ese plan
    -- para este servicio en particular.
    SELECT true, ps.dias_por_semana INTO v_incluido, v_dias_por_semana
    FROM usuarios u
    JOIN plan_servicios ps ON ps.plan_id = u.plan_id
    WHERE u.id = p_usuario_id AND ps.servicio_id = v_servicio_id;

    IF v_incluido IS NOT TRUE THEN
        RETURN QUERY SELECT false, 'Tu plan actual no incluye este servicio';
        RETURN;
    END IF;

    -- Sin cuota al día no se puede reservar. Nos fijamos si tiene un
    -- pago "pagado" para el mes/año de HOY (el estado de la cuota es
    -- sobre el mes corriente, no sobre el mes de la fecha reservada).
    SELECT EXISTS (
        SELECT 1 FROM pagos
        WHERE usuario_id = p_usuario_id
          AND mes = EXTRACT(MONTH FROM CURRENT_DATE)
          AND anio = EXTRACT(YEAR FROM CURRENT_DATE)
          AND estado = 'pagado'
    ) INTO v_pagado;

    IF NOT v_pagado THEN
        RETURN QUERY SELECT false, 'Tenés la cuota pendiente. Regularizá el pago para poder reservar turnos';
        RETURN;
    END IF;

    -- Si el plan tiene un tope de días por semana para este servicio
    -- (ej: Pilates 2x semana), contamos cuántos turnos activos ya
    -- tiene reservados en la semana (lunes a domingo) de la fecha
    -- pedida, y si ya llegó al tope, no dejamos sumar otro.
    IF v_dias_por_semana IS NOT NULL THEN
        v_inicio_semana := date_trunc('week', p_fecha)::date;
        v_fin_semana := v_inicio_semana + INTERVAL '6 days';

        SELECT COUNT(*) INTO v_reservas_semana
        FROM reservas r
        JOIN horarios h ON h.id = r.horario_id
        WHERE r.usuario_id = p_usuario_id
          AND r.estado = 'activa'
          AND h.servicio_id = v_servicio_id
          AND r.fecha BETWEEN v_inicio_semana AND v_fin_semana;

        IF v_reservas_semana >= v_dias_por_semana THEN
            RETURN QUERY SELECT false, format('Tu plan incluye %s turnos por semana para este servicio y ya los usaste', v_dias_por_semana);
            RETURN;
        END IF;
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