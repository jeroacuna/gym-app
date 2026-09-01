import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  const { usuario_id } = req.query
  if (!usuario_id) {
    return res.status(400).json({ error: 'Falta usuario_id' })
  }

  const { data: socio, error: errorSocio } = await supabaseAdmin
    .from('usuarios')
    .select('id, dni, nombre, apellido, email, telefono, activo, fecha_alta, plan_id, planes(id, nombre, precio)')
    .eq('id', usuario_id)
    .single()

  if (errorSocio || !socio) {
    return res.status(404).json({ error: 'Socio no encontrado' })
  }

  // --- Rutina activa ---
  const { data: rutina } = await supabaseAdmin
    .from('rutinas')
    .select('id, nombre')
    .eq('usuario_id', usuario_id)
    .eq('activa', true)
    .single()

  let ejercicios = []
  if (rutina) {
    const { data } = await supabaseAdmin
      .from('ejercicios')
      .select('id, nombre, series, repeticiones, peso_sugerido, dia_semana, orden')
      .eq('rutina_id', rutina.id)
      .order('orden', { ascending: true })
    ejercicios = data || []
  }

  // --- Historial de pagos (últimos 12 registros) ---
  const { data: pagos } = await supabaseAdmin
    .from('pagos')
    .select('mes, anio, estado, fecha_pago')
    .eq('usuario_id', usuario_id)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(12)

  const pagosConNombre = (pagos || []).map((p) => ({
    ...p,
    mes_nombre: NOMBRES_MES[p.mes - 1],
  }))

  // --- Próximas reservas ---
  const hoy = new Date().toISOString().slice(0, 10)
  const { data: reservas } = await supabaseAdmin
    .from('reservas')
    .select('id, fecha, horarios(hora_inicio, hora_fin, dia_semana)')
    .eq('usuario_id', usuario_id)
    .eq('estado', 'activa')
    .gte('fecha', hoy)
    .order('fecha', { ascending: true })

  return res.status(200).json({
    socio,
    rutina,
    ejercicios,
    pagos: pagosConNombre,
    reservas: reservas || [],
  })
}