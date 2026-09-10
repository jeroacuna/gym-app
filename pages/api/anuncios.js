import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

// Devuelve los anuncios activos, junto con un flag "visto" que indica
// si ESTE usuario en particular ya lo marcó como leído (ver
// /api/anuncios/marcar-visto). Así el front puede decidir a quién
// mostrarle el toast y qué dejar pendiente en la campanita, sin
// repetir avisos que la persona ya vio.
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { data: anuncios, error } = await supabaseAdmin
    .from('anuncios')
    .select('id, mensaje, creado_en')
    .eq('activo', true)
    .order('creado_en', { ascending: false })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar anuncios' })
  }

  // Traemos, en una sola consulta aparte, cuáles de estos anuncios
  // ya vio este usuario puntual (en vez del cruce automático de
  // Supabase — ver nota en mi-plan.js sobre por qué evitamos eso).
  const idsAnuncios = (anuncios || []).map((a) => a.id)
  const { data: vistos } = idsAnuncios.length
    ? await supabaseAdmin
        .from('anuncios_vistos')
        .select('anuncio_id')
        .eq('usuario_id', session.usuario.id)
        .in('anuncio_id', idsAnuncios)
    : { data: [] }

  const idsVistos = new Set((vistos || []).map((v) => v.anuncio_id))

  const resultado = (anuncios || []).map((a) => ({
    ...a,
    visto: idsVistos.has(a.id),
  }))

  return res.status(200).json({ anuncios: resultado })
}