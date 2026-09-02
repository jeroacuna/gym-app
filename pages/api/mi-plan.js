import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

// El dashboard del socio usa esto para saber qué pestañas mostrarle
// a la hora de reservar turno (gimnasio, pilates, o ambas).
//
// OJO: acá NO usamos los cruces automáticos de Supabase (tipo
// .select('planes(nombre)')) porque dependen de que la API tenga
// bien cacheadas las relaciones entre tablas, y eso a veces se
// desincroniza después de correr migraciones a mano. Hacemos las
// consultas simples, una por una, y cruzamos los datos acá mismo.
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const { data: usuario, error: errorUsuario } = await supabaseAdmin
    .from('usuarios')
    .select('plan_id')
    .eq('id', session.usuario.id)
    .single()

  if (errorUsuario || !usuario || !usuario.plan_id) {
    return res.status(200).json({ plan: null, servicios: [] })
  }

  const { data: plan } = await supabaseAdmin
    .from('planes')
    .select('id, nombre')
    .eq('id', usuario.plan_id)
    .single()

  const { data: filasPlanServicios } = await supabaseAdmin
    .from('plan_servicios')
    .select('servicio_id')
    .eq('plan_id', usuario.plan_id)

  const idsServicios = (filasPlanServicios || []).map((f) => f.servicio_id)

  if (idsServicios.length === 0) {
    return res.status(200).json({ plan: plan || null, servicios: [] })
  }

  const { data: servicios } = await supabaseAdmin
    .from('servicios')
    .select('id, nombre')
    .in('id', idsServicios)

  return res.status(200).json({ plan: plan || null, servicios: servicios || [] })
}