-- =========================================================
-- MIGRACIÓN: Soporte para múltiples servicios (Gimnasio, Pilates)
-- =========================================================
-- Idea general: el gimnasio y pilates pasan a ser "servicios"
-- distintos que comparten el mismo local. Un socio se anota a un
-- PLAN (ej: "Solo Gimnasio", "Solo Pilates", "Combo"), y ese plan
-- define a qué servicios tiene acceso. Los horarios (turnos) ahora
-- pertenecen a un servicio específico, así un turno de pilates no
-- se mezcla con uno de musculación.
--
-- Los pagos NO se tocan: siguen siendo un solo monto mensual por
-- socio (el combo ya viene con el descuento aplicado en el precio
-- del plan, no son dos pagos separados).

-- ---------------------------------------------------------
-- SERVICIOS
-- ---------------------------------------------------------
CREATE TABLE servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) UNIQUE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO servicios (nombre) VALUES ('Gimnasio'), ('Pilates');

-- ---------------------------------------------------------
-- PLANES
-- ---------------------------------------------------------
-- El precio vive acá, no por servicio. Así el combo simplemente
-- se carga con el precio final ya con descuento, sin que el
-- sistema tenga que andar calculando nada.
CREATE TABLE planes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10,2),
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- PLAN_SERVICIOS (qué servicios incluye cada plan)
-- ---------------------------------------------------------
CREATE TABLE plan_servicios (
    plan_id UUID NOT NULL REFERENCES planes(id) ON DELETE CASCADE,
    servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, servicio_id)
);

-- ---------------------------------------------------------
-- Plan por defecto, para que los socios que ya existen no
-- queden sin plan asignado (todos venían usando el gimnasio).
-- ---------------------------------------------------------
INSERT INTO planes (nombre, precio) VALUES ('Solo Gimnasio', NULL);

INSERT INTO plan_servicios (plan_id, servicio_id)
SELECT p.id, s.id FROM planes p, servicios s
WHERE p.nombre = 'Solo Gimnasio' AND s.nombre = 'Gimnasio';

-- ---------------------------------------------------------
-- USUARIOS: a qué plan está anotado el socio
-- ---------------------------------------------------------
ALTER TABLE usuarios ADD COLUMN plan_id UUID REFERENCES planes(id);

-- A todos los socios existentes les asignamos el plan "Solo
-- Gimnasio" para que sigan reservando turnos sin cortes.
UPDATE usuarios
SET plan_id = (SELECT id FROM planes WHERE nombre = 'Solo Gimnasio')
WHERE rol = 'socio';

-- ---------------------------------------------------------
-- HORARIOS: a qué servicio pertenece el turno
-- ---------------------------------------------------------
ALTER TABLE horarios ADD COLUMN servicio_id UUID REFERENCES servicios(id);

-- Todos los horarios que ya existían son de gimnasio.
UPDATE horarios
SET servicio_id = (SELECT id FROM servicios WHERE nombre = 'Gimnasio');

-- Ahora que están todos backfilleados, lo hacemos obligatorio.
ALTER TABLE horarios ALTER COLUMN servicio_id SET NOT NULL;

-- ---------------------------------------------------------
-- PERMISOS
-- ---------------------------------------------------------
-- Mismo bug que ya nos pasó con las tablas originales: hay que
-- darle permiso explícito al service_role sobre las tablas nuevas.
GRANT ALL ON TABLE servicios, planes, plan_servicios TO service_role;