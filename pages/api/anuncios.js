import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const { data: anuncios, error } = await supabaseAdmin
    .from('anuncios')
    .select('id, mensaje, creado_en')
    .eq('activo', true)
    .order('creado_en', { ascending: false })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar anuncios' })
  }

  return res.status(200).json({ anuncios: anuncios || [] })
}