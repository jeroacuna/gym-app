import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const { reserva_id } = req.body
  if (!reserva_id) {
    return res.status(400).json({ error: 'Falta el id de la reserva' })
  }

  // El .eq('usuario_id', ...) es la parte importante acá: así nos
  // aseguramos de que un usuario solo pueda cancelar SUS PROPIAS
  // reservas, y no las de cualquier otra persona con solo saber el id.
  const { error } = await supabaseAdmin
    .from('reservas')
    .update({ estado: 'cancelada' })
    .eq('id', reserva_id)
    .eq('usuario_id', session.usuario.id)

  if (error) {
    return res.status(500).json({ error: 'No se pudo cancelar la reserva' })
  }

  return res.status(200).json({ ok: true })
}
