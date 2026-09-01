-- =========================================================
-- MIGRACIÓN 2: límite de días por semana + bloqueo por no pago
-- =========================================================
-- Corré este script DESPUÉS de sql/migracion_pilates.sql
--
-- Un plan puede incluir un servicio con un tope de días por semana
-- (ej: "Pilates 2 veces por semana"). NULL significa sin límite
-- (así queda el gimnasio, típicamente libre).
ALTER TABLE plan_servicios ADD COLUMN dias_por_semana INTEGER;

COMMENT ON COLUMN plan_servicios.dias_por_semana IS
  'Cantidad máxima de turnos por semana que el socio puede reservar para este servicio dentro de este plan. NULL = sin límite.';

-- El chequeo de "no pagó, no reserva" y el de días por semana se
-- implementan dentro de la función reservar_turno (ver
-- sql/reservar_turno.sql, ya actualizado).