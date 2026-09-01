import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

// Endpoint simple, de solo lectura: la lista de servicios (Gimnasio,
// Pilates) se usa para armar los selectores en "Planes" y "Horarios".
// No hace falta un CRUD acá — los servicios son parte de la
// estructura del negocio, no algo que el admin cree todos los días.
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { data: servicios, error } = await supabaseAdmin
    .from('servicios')
    .select('id, nombre, activo')
    .order('nombre', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar servicios' })
  }

  return res.status(200).json({ servicios: servicios || [] })
}