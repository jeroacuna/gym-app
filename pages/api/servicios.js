import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

// A diferencia de /api/admin/servicios (que es solo para el admin),
// este endpoint lo puede llamar cualquier socio logueado. Sirve para
// mostrar TODAS las actividades del gimnasio en el dashboard, incluso
// las que el socio no tiene incluidas en su plan (para que sepa que
// existen, aunque no pueda reservar ahí todavía).
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { data: servicios, error } = await supabaseAdmin
    .from('servicios')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar servicios' })
  }

  return res.status(200).json({ servicios: servicios || [] })
}