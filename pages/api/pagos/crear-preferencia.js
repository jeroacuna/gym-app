import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'
import { crearPreferenciaCuota } from '../../../lib/mercadopago'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const hoy = new Date()
  const mes = hoy.getMonth() + 1
  const anio = hoy.getFullYear()

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('nombre, apellido, plan_id')
    .eq('id', session.usuario.id)
    .single()

  if (!usuario) {
    return res.status(404).json({ error: 'Usuario no encontrado' })
  }

  // Si el plan no tiene precio cargado todavía (estamos en modo
  // prueba), cobramos $1 para poder probar el circuito completo sin
  // comprometer plata real.
  let monto = 1
  if (usuario.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from('planes')
      .select('precio')
      .eq('id', usuario.plan_id)
      .single()
    if (plan?.precio) monto = plan.precio
  }

  try {
    const baseUrl = `https://${req.headers.host}`
    const initPoint = await crearPreferenciaCuota({
      usuarioId: session.usuario.id,
      nombreSocio: `${usuario.nombre} ${usuario.apellido}`,
      mes,
      anio,
      monto,
      baseUrl,
    })

    return res.status(200).json({ url: initPoint })
  } catch (err) {
    console.error('Error al crear preferencia:', err)
    return res.status(500).json({ error: err.message || 'No se pudo generar el link de pago' })
  }
}