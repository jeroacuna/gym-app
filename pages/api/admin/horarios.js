import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

const MAPA_DIA_A_NUMERO = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }

// Como los horarios son una plantilla semanal (no una fecha puntual),
// para mostrarle al admin "cuántos cupos quedan" necesitamos elegir
// UNA fecha concreta: la próxima vez que ese día de la semana ocurra
// (hoy mismo si coincide, si no el próximo).
function proximaFecha(diaSemana) {
  const hoy = new Date()
  const objetivo = MAPA_DIA_A_NUMERO[diaSemana]
  const diferencia = (objetivo - hoy.getDay() + 7) % 7
  const fecha = new Date(hoy)
  fecha.setDate(hoy.getDate() + diferencia)
  return fecha.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method === 'GET') {
    // Traemos TODOS los horarios (activos e inactivos), el front se
    // encarga de mostrarlos agrupados y marcados según corresponda.
    const { data: horarios, error } = await supabaseAdmin
      .from('horarios')
      .select('id, dia_semana, hora_inicio, hora_fin, capacidad_maxima, activo, servicio_id, servicios(nombre)')
      .order('hora_inicio', { ascending: true })

    if (error) {
      return res.status(500).json({ error: 'Error al buscar horarios' })
    }

    // A cada horario le calculamos su próxima fecha, y de paso
    // juntamos todas esas fechas para hacer UNA sola consulta de
    // reservas en vez de una por horario.
    const conFecha = (horarios || []).map((h) => ({ ...h, proxima_fecha: proximaFecha(h.dia_semana) }))
    const fechas = [...new Set(conFecha.map((h) => h.proxima_fecha))]

    const { data: reservas, error: errorReservas } = await supabaseAdmin
      .from('reservas')
      .select('horario_id, fecha')
      .eq('estado', 'activa')
      .in('fecha', fechas)

    if (errorReservas) {
      return res.status(500).json({ error: 'No se pudieron calcular los cupos ocupados' })
    }

    const horariosConCupos = conFecha.map((h) => {
      const ocupados = (reservas || []).filter(
        (r) => r.horario_id === h.id && r.fecha === h.proxima_fecha
      ).length
      return { ...h, ocupados }
    })

    return res.status(200).json({ horarios: horariosConCupos })
  }

  if (req.method === 'POST') {
    const { dia_semana, hora_inicio, hora_fin, capacidad_maxima, servicio_id } = req.body
    if (!dia_semana || !hora_inicio || !hora_fin || !capacidad_maxima || !servicio_id) {
      return res.status(400).json({ error: 'Faltan datos del horario (incluyendo el servicio)' })
    }

    const { data, error } = await supabaseAdmin
      .from('horarios')
      .insert({ dia_semana, hora_inicio, hora_fin, capacidad_maxima, servicio_id })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: 'No se pudo crear el horario' })
    }

    return res.status(200).json({ horario: data })
  }

  if (req.method === 'PUT') {
    // Sirve tanto para editar hora/capacidad como para activar/desactivar
    // (mandando solo el campo "activo" en el body).
    const { id, dia_semana, hora_inicio, hora_fin, capacidad_maxima, activo, servicio_id } = req.body
    if (!id) {
      return res.status(400).json({ error: 'Falta el id del horario' })
    }

    const cambios = {}
    if (dia_semana !== undefined) cambios.dia_semana = dia_semana
    if (hora_inicio !== undefined) cambios.hora_inicio = hora_inicio
    if (hora_fin !== undefined) cambios.hora_fin = hora_fin
    if (capacidad_maxima !== undefined) cambios.capacidad_maxima = capacidad_maxima
    if (activo !== undefined) cambios.activo = activo
    if (servicio_id !== undefined) cambios.servicio_id = servicio_id

    const { error } = await supabaseAdmin.from('horarios').update(cambios).eq('id', id)

    if (error) {
      return res.status(500).json({ error: 'No se pudo actualizar el horario' })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}