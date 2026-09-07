import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const hoy = new Date()
  const { data: pago } = await supabaseAdmin
    .from('pagos')
    .select('estado')
    .eq('usuario_id', session.usuario.id)
    .eq('mes', hoy.getMonth() + 1)
    .eq('anio', hoy.getFullYear())
    .maybeSingle()

  return res.status(200).json({ pagado: pago?.estado === 'pagado' })
}