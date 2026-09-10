import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

// Marca un anuncio como "visto" para el usuario logueado. Usamos
// upsert sobre la clave primaria compuesta (usuario_id, anuncio_id)
// para que no importe si lo llamamos dos veces por accidente (ej:
// doble click en la campanita).
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { anuncio_id } = req.body
  if (!anuncio_id) {
    return res.status(400).json({ error: 'Falta el id del anuncio' })
  }

  const { error } = await supabaseAdmin
    .from('anuncios_vistos')
    .upsert(
      { usuario_id: session.usuario.id, anuncio_id },
      { onConflict: 'usuario_id,anuncio_id' }
    )

  if (error) {
    return res.status(500).json({ error: 'No se pudo marcar el anuncio como visto' })
  }

  return res.status(200).json({ ok: true })
}