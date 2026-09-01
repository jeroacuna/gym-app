import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

// El dashboard del socio usa esto para saber qué pestañas mostrarle
// a la hora de reservar turno (gimnasio, pilates, o ambas).
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const { data: usuario, error: errorUsuario } = await supabaseAdmin
    .from('usuarios')
    .select('plan_id, planes(id, nombre)')
    .eq('id', session.usuario.id)
    .single()

  if (errorUsuario || !usuario || !usuario.plan_id) {
    return res.status(200).json({ plan: null, servicios: [] })
  }

  const { data: servicios } = await supabaseAdmin
    .from('plan_servicios')
    .select('servicios(id, nombre)')
    .eq('plan_id', usuario.plan_id)

  return res.status(200).json({
    plan: usuario.planes,
    servicios: (servicios || []).map((s) => s.servicios),
  })
}