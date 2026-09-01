import { supabaseAdmin } from '../../lib/supabaseClient'

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export default async function handler(req, res) {
  const { fecha, servicio_id } = req.query

  if (!fecha) {
    return res.status(400).json({ error: 'Falta la fecha' })
  }

  if (!servicio_id) {
    return res.status(400).json({ error: 'Falta el servicio (gimnasio o pilates)' })
  }

  // OJO con esto: parseamos agregando "T00:00:00" para que JavaScript
  // interprete la fecha en horario local y no nos corra un día para
  // atrás por husos horarios (un bug clásico y molesto).
  const fechaObj = new Date(`${fecha}T00:00:00`)
  const diaSemana = DIAS[fechaObj.getDay()]

  const { data: horarios, error } = await supabaseAdmin
    .from('horarios')
    .select('id, hora_inicio, hora_fin, capacidad_maxima')
    .eq('dia_semana', diaSemana)
    .eq('servicio_id', servicio_id)
    .eq('activo', true)
    .order('hora_inicio', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar horarios' })
  }

  const { data: reservasDelDia } = await supabaseAdmin
    .from('reservas')
    .select('horario_id')
    .eq('fecha', fecha)
    .eq('estado', 'activa')

  const ocupadosPorHorario = {}
  ;(reservasDelDia || []).forEach((r) => {
    ocupadosPorHorario[r.horario_id] = (ocupadosPorHorario[r.horario_id] || 0) + 1
  })

  const resultado = (horarios || []).map((h) => {
    const ocupados = ocupadosPorHorario[h.id] || 0
    return {
      id: h.id,
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      capacidad_maxima: h.capacidad_maxima,
      ocupados,
      disponible: ocupados < h.capacidad_maxima,
    }
  })

  return res.status(200).json({ fecha, dia_semana: diaSemana, horarios: resultado })
}