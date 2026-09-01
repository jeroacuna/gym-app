-- Horarios de ejemplo para poder probar el sistema de reservas
-- ya mismo, sin esperar a tener el panel de administración armado.
-- Podés editar estos valores o agregar más filas a mano desde el
-- Table Editor de Supabase.

INSERT INTO horarios (dia_semana, hora_inicio, hora_fin, capacidad_maxima) VALUES
    ('lunes', '16:00', '17:00', 10),
    ('lunes', '17:00', '18:00', 10),
    ('miercoles', '16:00', '17:00', 10),
    ('viernes', '16:00', '17:00', 10),
    ('viernes', '17:00', '18:00', 10);
