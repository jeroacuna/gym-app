import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  const { horario_id, fecha } = req.query
  if (!horario_id || !fecha) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  const { data: anotados, error } = await supabaseAdmin
    .from('reservas')
    .select('id, usuarios(id, nombre, apellido, dni)')
    .eq('horario_id', horario_id)
    .eq('fecha', fecha)
    .eq('estado', 'activa')

  if (error) {
    return res.status(500).json({ error: 'No se pudo obtener la lista' })
  }

  return res.status(200).json({ anotados: anotados || [] })
}