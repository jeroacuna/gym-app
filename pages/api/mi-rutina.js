import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const { data: rutina } = await supabaseAdmin
    .from('rutinas')
    .select('id, nombre')
    .eq('usuario_id', session.usuario.id)
    .eq('activa', true)
    .single()

  if (!rutina) {
    // No es un error: simplemente todavía no le cargaron una rutina.
    return res.status(200).json({ rutina: null, ejercicios: [] })
  }

  const { data: ejercicios } = await supabaseAdmin
    .from('ejercicios')
    .select('id, nombre, series, repeticiones, peso_sugerido, dia_semana, bloque, orden')
    .eq('rutina_id', rutina.id)
    .order('orden', { ascending: true })

  return res.status(200).json({ rutina, ejercicios: ejercicios || [] })
}