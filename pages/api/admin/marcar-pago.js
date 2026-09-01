import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  const { usuario_id, pagado } = req.body
  if (!usuario_id || typeof pagado !== 'boolean') {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  const ahora = new Date()
  const mes = ahora.getMonth() + 1
  const anio = ahora.getFullYear()

  const { error } = await supabaseAdmin
    .from('pagos')
    .upsert(
      {
        usuario_id,
        mes,
        anio,
        estado: pagado ? 'pagado' : 'pendiente',
        fecha_pago: pagado ? new Date().toISOString() : null,
      },
      { onConflict: 'usuario_id,mes,anio' }
    )

  if (error) {
    return res.status(500).json({ error: 'No se pudo actualizar el pago' })
  }

  return res.status(200).json({ ok: true })
}