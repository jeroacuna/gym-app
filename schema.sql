-- =========================================================
-- ESQUEMA DE BASE DE DATOS - APP GIMNASIO
-- =========================================================
-- Pensado para PostgreSQL (Supabase). Comentado en cada tabla
-- para que quede claro el "por qué" de cada decisión.

-- ---------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------
-- Guarda tanto socios como al dueño/admin del gimnasio.
-- El DNI es único porque es la forma en la que el usuario
-- se identifica, pero el login real (por seguridad) se maneja
-- con Supabase Auth + un PIN o magic link asociado, no con
-- el DNI solo.
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni VARCHAR(15) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    telefono VARCHAR(30),
    rol VARCHAR(10) NOT NULL DEFAULT 'socio' CHECK (rol IN ('socio', 'admin')),
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_alta TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- RUTINAS
-- ---------------------------------------------------------
-- Cada socio puede tener una rutina activa. Si el día de
-- mañana el gimnasio quiere guardar historial de rutinas
-- viejas, alcanza con no borrarlas y filtrar por "activa".
CREATE TABLE rutinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL DEFAULT 'Rutina actual',
    activa BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- EJERCICIOS
-- ---------------------------------------------------------
-- Los ejercicios que componen una rutina. "orden" sirve para
-- mostrarlos siempre en el mismo orden en la app (día 1, día 2, etc).
CREATE TABLE ejercicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rutina_id UUID NOT NULL REFERENCES rutinas(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    series INTEGER NOT NULL,
    repeticiones VARCHAR(20) NOT NULL, -- texto para permitir "8-12", "hasta el fallo", etc.
    peso_sugerido VARCHAR(20),
    dia_semana VARCHAR(15), -- ej: "lunes", "miercoles" (a qué día de la rutina pertenece)
    orden INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------
-- HORARIOS (plantilla semanal, se repite todas las semanas)
-- ---------------------------------------------------------
-- Esto define LOS SLOTS QUE EXISTEN, no las reservas en sí.
-- Ej: "Viernes de 16:00 a 17:00, capacidad 10".
CREATE TABLE horarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dia_semana VARCHAR(15) NOT NULL CHECK (
        dia_semana IN ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')
    ),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    capacidad_maxima INTEGER NOT NULL DEFAULT 10,
    activo BOOLEAN NOT NULL DEFAULT true
);

-- ---------------------------------------------------------
-- RESERVAS
-- ---------------------------------------------------------
-- Acá es donde vive la lógica de "cupo lleno". Guardamos la
-- FECHA CONCRETA (no solo el día de la semana) porque un
-- horario se repite cada semana, pero cada ocurrencia
-- específica (ej: viernes 5/9 a las 16hs) tiene su propio cupo.
--
-- La restricción UNIQUE evita que la misma persona se anote
-- dos veces al mismo horario el mismo día.
CREATE TABLE reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    horario_id UUID NOT NULL REFERENCES horarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, horario_id, fecha)
);

-- Índice para que la consulta "cuántos hay anotados en este
-- horario, este día" sea rápida (se va a hacer todo el tiempo).
CREATE INDEX idx_reservas_horario_fecha ON reservas(horario_id, fecha) WHERE estado = 'activa';

-- ---------------------------------------------------------
-- PAGOS
-- ---------------------------------------------------------
-- Un registro por mes/socio. El dueño carga el pago manualmente
-- (transferencia, efectivo) o se integra a un medio de pago después.
CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio INTEGER NOT NULL,
    monto NUMERIC(10,2),
    estado VARCHAR(15) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pagado', 'pendiente')),
    fecha_pago TIMESTAMPTZ,
    UNIQUE (usuario_id, mes, anio)
);
