import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

// Los planes ahora son FIJOS: Gimnasio, Pilates, Gimnasio + Pilates.
// Se cargan una sola vez por SQL (ver sql/migracion_planes_fijos.sql)
// y no hay pantalla para crear/editar más — este endpoint es de
// SOLO LECTURA, lo usan admin/socios.js (para el selector) y
// admin/ficha-socio.js (para mostrar el plan del socio).
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Los planes son fijos, no se pueden crear ni editar desde acá' })
  }

  const { data: planes, error } = await supabaseAdmin
    .from('planes')
    .select('id, nombre, precio, activo')
    .order('nombre', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar planes' })
  }

  const { data: filasPlanServicios } = await supabaseAdmin
    .from('plan_servicios')
    .select('plan_id, servicio_id, dias_por_semana')

  const { data: servicios } = await supabaseAdmin.from('servicios').select('id, nombre')
  const servicioPorId = {}
  ;(servicios || []).forEach((s) => { servicioPorId[s.id] = s })

  const resultado = (planes || []).map((p) => {
    const filas = (filasPlanServicios || []).filter((f) => f.plan_id === p.id)
    return {
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      activo: p.activo,
      servicios: filas
        .filter((f) => servicioPorId[f.servicio_id])
        .map((f) => ({
          id: f.servicio_id,
          nombre: servicioPorId[f.servicio_id].nombre,
          dias_por_semana: f.dias_por_semana,
        })),
    }
  })

  return res.status(200).json({ planes: resultado })
}