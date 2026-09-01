import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

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

    return res.status(200).json({ horarios: horarios || [] })
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