import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)

  // Doble candado: no solo hay que estar logueado, hay que ser admin.
  // Esto es importante porque las páginas (admin.js) ya lo chequean,
  // pero un endpoint de API es una puerta aparte — si alguien le
  // pega directo a esta URL sin pasar por la pantalla, este chequeo
  // es lo único que lo frena.
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method === 'POST') {
    const { dni, nombre, apellido, email, telefono } = req.body

    if (!dni || !nombre || !apellido) {
      return res.status(400).json({ error: 'DNI, nombre y apellido son obligatorios' })
    }

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        dni: dni.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email || null,
        telefono: telefono || null,
        rol: 'socio',
      })
      .select()
      .single()

    if (error) {
      // Código 23505 = violación de restricción UNIQUE (el DNI ya existe).
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un socio con ese DNI' })
      }
      return res.status(500).json({ error: 'No se pudo crear el socio' })
    }

    return res.status(200).json({ socio: data })
  }

  if (req.method === 'PUT') {
    const { id, nombre, apellido, email, telefono, activo } = req.body
    if (!id) {
      return res.status(400).json({ error: 'Falta el id del socio' })
    }

    // Igual que en horarios: armamos el objeto solo con los campos que
    // realmente vinieron, así este mismo endpoint sirve tanto para
    // editar datos como para dar de baja (mandando solo "activo").
    const cambios = {}
    if (nombre !== undefined) cambios.nombre = nombre
    if (apellido !== undefined) cambios.apellido = apellido
    if (email !== undefined) cambios.email = email || null
    if (telefono !== undefined) cambios.telefono = telefono || null
    if (activo !== undefined) cambios.activo = activo

    const { error } = await supabaseAdmin.from('usuarios').update(cambios).eq('id', id)

    if (error) {
      return res.status(500).json({ error: 'No se pudo actualizar el socio' })
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const ahora = new Date()
  const mes = ahora.getMonth() + 1 // getMonth() devuelve 0-11
  const anio = ahora.getFullYear()

  // El parámetro ?todos=true hace que también traiga los socios dados
  // de baja (activo = false). Sin ese parámetro, solo trae los activos
  // — así el selector de rutinas o la lista de pagos no se llenan de
  // gente que ya no va al gimnasio.
  let query = supabaseAdmin
    .from('usuarios')
    .select('id, nombre, apellido, dni, email, telefono, activo')
    .eq('rol', 'socio')
    .order('apellido', { ascending: true })

  if (req.query.todos !== 'true') {
    query = query.eq('activo', true)
  }

  const { data: socios, error: errorSocios } = await query

  if (errorSocios) {
    return res.status(500).json({ error: 'Error al buscar socios' })
  }

  const { data: pagos } = await supabaseAdmin
    .from('pagos')
    .select('usuario_id, estado')
    .eq('mes', mes)
    .eq('anio', anio)

  const estadoPorUsuario = {}
  ;(pagos || []).forEach((p) => {
    estadoPorUsuario[p.usuario_id] = p.estado
  })

  const resultado = (socios || []).map((s) => ({
    ...s,
    pagado: estadoPorUsuario[s.id] === 'pagado',
  }))

  return res.status(200).json({ mes, anio, socios: resultado })
}