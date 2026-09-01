import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { dni } = req.body

  if (!dni || typeof dni !== 'string') {
    return res.status(400).json({ error: 'Ingresá tu DNI' })
  }

  // Buscamos al usuario. Ojo: esto es el punto donde, si en el futuro
  // agregan un PIN, se sumaría "eq('pin', pin)" acá mismo, sin tocar
  // nada más del resto de la app.
  const { data: usuario, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, apellido, rol, activo')
    .eq('dni', dni.trim())
    .single()

  if (error || !usuario) {
    return res.status(401).json({ error: 'DNI no encontrado. Consultá en recepción.' })
  }

  if (!usuario.activo) {
    return res.status(403).json({ error: 'Tu cuenta está inactiva. Consultá con el gimnasio.' })
  }

  const session = await getIronSession(req, res, sessionOptions)
  session.usuario = {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
  }
  await session.save()

  return res.status(200).json({ ok: true, rol: usuario.rol })
}
