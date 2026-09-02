import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method === 'GET') {
    const { data: anuncios, error } = await supabaseAdmin
      .from('anuncios')
      .select('id, mensaje, activo, creado_en')
      .order('creado_en', { ascending: false })

    if (error) {
      return res.status(500).json({ error: 'Error al buscar anuncios' })
    }

    return res.status(200).json({ anuncios: anuncios || [] })
  }

  if (req.method === 'POST') {
    const { mensaje } = req.body
    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'El anuncio no puede estar vacío' })
    }

    const { data, error } = await supabaseAdmin
      .from('anuncios')
      .insert({ mensaje: mensaje.trim() })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: 'No se pudo crear el anuncio' })
    }

    return res.status(200).json({ anuncio: data })
  }

  if (req.method === 'PUT') {
    // Se usa solo para activar/desactivar (mostrar u ocultar) el
    // anuncio, no hace falta editar el texto una vez publicado.
    const { id, activo } = req.body
    if (!id) {
      return res.status(400).json({ error: 'Falta el id del anuncio' })
    }

    const { error } = await supabaseAdmin.from('anuncios').update({ activo }).eq('id', id)
    if (error) {
      return res.status(500).json({ error: 'No se pudo actualizar el anuncio' })
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) {
      return res.status(400).json({ error: 'Falta el id del anuncio' })
    }

    const { error } = await supabaseAdmin.from('anuncios').delete().eq('id', id)
    if (error) {
      return res.status(500).json({ error: 'No se pudo borrar el anuncio' })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}