import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method === 'GET') {
    // Traemos los planes junto con sus servicios incluidos (y el tope
    // semanal de cada uno, si tiene), para que el front pueda mostrar
    // directamente "Combo — Gimnasio + Pilates (2x semana)".
    const { data: planes, error } = await supabaseAdmin
      .from('planes')
      .select('id, nombre, precio, activo, plan_servicios(servicio_id, dias_por_semana, servicios(id, nombre))')
      .order('creado_en', { ascending: true })

    if (error) {
      return res.status(500).json({ error: 'Error al buscar planes' })
    }

    // Aplanamos plan_servicios a una lista simple, más cómoda de usar
    // en el front que el shape anidado que devuelve Supabase.
    const resultado = (planes || []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      activo: p.activo,
      servicios: (p.plan_servicios || []).map((ps) => ({
        id: ps.servicios.id,
        nombre: ps.servicios.nombre,
        dias_por_semana: ps.dias_por_semana,
      })),
    }))

    return res.status(200).json({ planes: resultado })
  }

  // "servicios" viene como: [{ servicio_id, dias_por_semana }, ...]
  // dias_por_semana puede venir null/undefined = sin límite.
  function validarServicios(servicios) {
    return (
      Array.isArray(servicios) &&
      servicios.length > 0 &&
      servicios.every((s) => s && s.servicio_id)
    )
  }

  if (req.method === 'POST') {
    const { nombre, precio, servicios } = req.body
    if (!nombre || !validarServicios(servicios)) {
      return res.status(400).json({ error: 'Faltan datos: nombre y al menos un servicio' })
    }

    const { data: plan, error: errorPlan } = await supabaseAdmin
      .from('planes')
      .insert({ nombre, precio: precio || null })
      .select()
      .single()

    if (errorPlan) {
      return res.status(500).json({ error: 'No se pudo crear el plan' })
    }

    const filas = servicios.map((s) => ({
      plan_id: plan.id,
      servicio_id: s.servicio_id,
      dias_por_semana: s.dias_por_semana || null,
    }))
    const { error: errorRelacion } = await supabaseAdmin.from('plan_servicios').insert(filas)

    if (errorRelacion) {
      return res.status(500).json({ error: 'El plan se creó, pero no se pudieron asignar los servicios' })
    }

    return res.status(200).json({ plan })
  }

  if (req.method === 'PUT') {
    const { id, nombre, precio, servicios, activo } = req.body
    if (!id) {
      return res.status(400).json({ error: 'Falta el id del plan' })
    }

    const cambios = {}
    if (nombre !== undefined) cambios.nombre = nombre
    if (precio !== undefined) cambios.precio = precio || null
    if (activo !== undefined) cambios.activo = activo

    if (Object.keys(cambios).length > 0) {
      const { error } = await supabaseAdmin.from('planes').update(cambios).eq('id', id)
      if (error) {
        return res.status(500).json({ error: 'No se pudo actualizar el plan' })
      }
    }

    // Si mandan "servicios", reemplazamos por completo la relación
    // (borramos las viejas y cargamos las nuevas). Para un admin panel
    // con este volumen de datos, es más simple y confiable que tratar
    // de calcular un diff.
    if (servicios !== undefined) {
      if (!validarServicios(servicios)) {
        return res.status(400).json({ error: 'Un plan necesita al menos un servicio' })
      }

      const { error: errorBorrar } = await supabaseAdmin.from('plan_servicios').delete().eq('plan_id', id)
      if (errorBorrar) {
        return res.status(500).json({ error: 'No se pudieron actualizar los servicios del plan' })
      }

      const filas = servicios.map((s) => ({
        plan_id: id,
        servicio_id: s.servicio_id,
        dias_por_semana: s.dias_por_semana || null,
      }))
      const { error: errorInsertar } = await supabaseAdmin.from('plan_servicios').insert(filas)
      if (errorInsertar) {
        return res.status(500).json({ error: 'No se pudieron actualizar los servicios del plan' })
      }
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}