import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method === 'POST') {
    const { rutina_id, nombre, series, repeticiones, peso_sugerido, dia_semana, bloque, orden } = req.body
    if (!rutina_id || !nombre || !series || !repeticiones) {
      return res.status(400).json({ error: 'Faltan datos del ejercicio' })
    }

    const { data, error } = await supabaseAdmin
      .from('ejercicios')
      .insert({ rutina_id, nombre, series, repeticiones, peso_sugerido, dia_semana, bloque: bloque || 'fuerza_1', orden: orden || 0 })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: 'No se pudo agregar el ejercicio' })
    }

    return res.status(200).json({ ejercicio: data })
  }

  if (req.method === 'PUT') {
    const { id, nombre, series, repeticiones, peso_sugerido, dia_semana, bloque, orden } = req.body
    if (!id) {
      return res.status(400).json({ error: 'Falta el id del ejercicio' })
    }

    const { error } = await supabaseAdmin
      .from('ejercicios')
      .update({ nombre, series, repeticiones, peso_sugerido, dia_semana, bloque, orden })
      .eq('id', id)

    if (error) {
      return res.status(500).json({ error: 'No se pudo actualizar el ejercicio' })
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) {
      return res.status(400).json({ error: 'Falta el id del ejercicio' })
    }

    const { error } = await supabaseAdmin.from('ejercicios').delete().eq('id', id)

    if (error) {
      return res.status(500).json({ error: 'No se pudo eliminar el ejercicio' })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}