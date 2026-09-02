import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method === 'GET') {
    const { usuario_id } = req.query
    if (!usuario_id) {
      return res.status(400).json({ error: 'Falta usuario_id' })
    }

    const { data: rutina } = await supabaseAdmin
      .from('rutinas')
      .select('id, nombre')
      .eq('usuario_id', usuario_id)
      .eq('activa', true)
      .single()

    if (!rutina) {
      return res.status(200).json({ rutina: null, ejercicios: [] })
    }

    const { data: ejercicios } = await supabaseAdmin
      .from('ejercicios')
      .select('id, nombre, series, repeticiones, peso_sugerido, dia_semana, bloque, orden')
      .eq('rutina_id', rutina.id)
      .order('orden', { ascending: true })

    return res.status(200).json({ rutina, ejercicios: ejercicios || [] })
  }

  if (req.method === 'POST') {
    // Crea una rutina nueva para un socio que todavía no tiene una activa.
    const { usuario_id, nombre } = req.body
    if (!usuario_id) {
      return res.status(400).json({ error: 'Falta usuario_id' })
    }

    const { data: existente } = await supabaseAdmin
      .from('rutinas')
      .select('id')
      .eq('usuario_id', usuario_id)
      .eq('activa', true)
      .single()

    if (existente) {
      return res.status(409).json({ error: 'Este socio ya tiene una rutina activa' })
    }

    const { data: nueva, error } = await supabaseAdmin
      .from('rutinas')
      .insert({ usuario_id, nombre: nombre || 'Rutina actual' })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: 'No se pudo crear la rutina' })
    }

    return res.status(200).json({ rutina: nueva })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}