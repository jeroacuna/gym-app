import { supabaseAdmin } from './supabaseClient'

const MAPA_DIA_A_NUMERO = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }

// Cuántas semanas para adelante generamos reservas automáticamente.
// 4 semanas cubre "el mes", que es como se piensa la cuota.
const SEMANAS_A_GENERAR = 4

function formatearFecha(fecha) {
  return fecha.toISOString().slice(0, 10)
}

// Dado un día de la semana (ej: "lunes"), devuelve las próximas N
// fechas (YYYY-MM-DD) en que ese día ocurre, empezando desde hoy
// (incluyendo hoy si coincide).
function proximasFechas(diaSemana, cantidad) {
  const objetivo = MAPA_DIA_A_NUMERO[diaSemana]
  const hoy = new Date()
  const primera = new Date(hoy)
  const diferencia = (objetivo - hoy.getDay() + 7) % 7
  primera.setDate(hoy.getDate() + diferencia)

  const fechas = []
  for (let i = 0; i < cantidad; i++) {
    const f = new Date(primera)
    f.setDate(primera.getDate() + i * 7)
    fechas.push(formatearFecha(f))
  }
  return fechas
}

// Se llama cada vez que el socio abre el dashboard (o el admin le
// asigna un turno fijo nuevo). Revisa sus turnos fijos activos y, si
// falta la reserva de alguna de las próximas semanas, la crea.
//
// Si el socio ya canceló puntualmente una semana (queda una fila en
// "reservas" con estado 'cancelada' para esa fecha), NO la volvemos
// a crear — eso es justamente lo que le permite faltar un día sin
// perder el turno fijo de las semanas siguientes.
//
// Tampoco generamos nada si la cuota del mes actual no está pagada,
// coherente con la regla de "sin pago, no hay reserva nueva".
export async function generarReservasDeTurnosFijos(usuarioId) {
  const { data: turnosFijos } = await supabaseAdmin
    .from('turnos_fijos')
    .select('id, horario_id')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)

  if (!turnosFijos || turnosFijos.length === 0) return

  const hoy = new Date()
  const { data: pago } = await supabaseAdmin
    .from('pagos')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('mes', hoy.getMonth() + 1)
    .eq('anio', hoy.getFullYear())
    .eq('estado', 'pagado')
    .maybeSingle()

  if (!pago) return // cuota pendiente: no generamos turnos nuevos

  const idsHorarios = turnosFijos.map((t) => t.horario_id)
  const { data: horarios } = await supabaseAdmin
    .from('horarios')
    .select('id, dia_semana, activo')
    .in('id', idsHorarios)

  const horarioPorId = {}
  ;(horarios || []).forEach((h) => { horarioPorId[h.id] = h })

  for (const turno of turnosFijos) {
    const horario = horarioPorId[turno.horario_id]
    if (!horario || !horario.activo) continue

    const fechas = proximasFechas(horario.dia_semana, SEMANAS_A_GENERAR)

    // Traemos de una sola vez qué reservas (activas o canceladas) ya
    // existen para este horario en esas fechas, para no duplicar ni
    // pisar una cancelación puntual que ya hizo el socio.
    const { data: existentes } = await supabaseAdmin
      .from('reservas')
      .select('fecha')
      .eq('usuario_id', usuarioId)
      .eq('horario_id', turno.horario_id)
      .in('fecha', fechas)

    const fechasConFila = new Set((existentes || []).map((r) => r.fecha))
    const fechasAGenerar = fechas.filter((f) => !fechasConFila.has(f))

    if (fechasAGenerar.length === 0) continue

    const filasNuevas = fechasAGenerar.map((fecha) => ({
      usuario_id: usuarioId,
      horario_id: turno.horario_id,
      fecha,
      estado: 'activa',
    }))

    // Insertamos de a una si hace falta, para que si una fecha puntual
    // falla (ej: el cupo ya está lleno esa semana por otro motivo), no
    // se caigan las demás fechas por culpa de esa una.
    for (const fila of filasNuevas) {
      await supabaseAdmin.from('reservas').insert(fila)
      // Si falla (cupo lleno, choque de horario, etc.) simplemente no
      // queda generada esa semana puntual — no rompe el resto.
    }
  }
}