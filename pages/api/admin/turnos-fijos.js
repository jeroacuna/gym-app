import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'
import { generarReservasDeTurnosFijos } from '../../../lib/turnosFijos'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method === 'GET') {
    const { usuario_id } = req.query
    if (!usuario_id) {
      return res.status(400).json({ error: 'Falta el usuario' })
    }

    const { data: turnos, error } = await supabaseAdmin
      .from('turnos_fijos')
      .select('id, horario_id')
      .eq('usuario_id', usuario_id)
      .eq('activo', true)

    if (error) {
      return res.status(500).json({ error: 'Error al buscar turnos fijos' })
    }

    if (!turnos || turnos.length === 0) {
      return res.status(200).json({ turnosFijos: [] })
    }

    const idsHorarios = turnos.map((t) => t.horario_id)
    const { data: horarios } = await supabaseAdmin
      .from('horarios')
      .select('id, dia_semana, hora_inicio, hora_fin, servicio_id')
      .in('id', idsHorarios)

    const { data: servicios } = await supabaseAdmin.from('servicios').select('id, nombre')
    const servicioPorId = {}
    ;(servicios || []).forEach((s) => { servicioPorId[s.id] = s })

    const horarioPorId = {}
    ;(horarios || []).forEach((h) => { horarioPorId[h.id] = h })

    const resultado = turnos
      .filter((t) => horarioPorId[t.horario_id])
      .map((t) => {
        const h = horarioPorId[t.horario_id]
        return {
          id: t.id,
          horario_id: t.horario_id,
          dia_semana: h.dia_semana,
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
          servicio_nombre: servicioPorId[h.servicio_id]?.nombre || '',
        }
      })

    return res.status(200).json({ turnosFijos: resultado })
  }

  if (req.method === 'POST') {
    const { usuario_id, horario_id } = req.body
    if (!usuario_id || !horario_id) {
      return res.status(400).json({ error: 'Faltan datos' })
    }

    // Chequeamos que el socio tenga un plan que incluya el servicio
    // de este horario, y que no se pase del límite semanal de su plan
    // para ese servicio (mismo criterio que reservar_turno, pero acá
    // lo vemos antes de insertar el turno fijo).
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('plan_id')
      .eq('id', usuario_id)
      .single()

    if (!usuario || !usuario.plan_id) {
      return res.status(400).json({ error: 'Este socio no tiene un plan asignado' })
    }

    const { data: horario } = await supabaseAdmin
      .from('horarios')
      .select('id, servicio_id')
      .eq('id', horario_id)
      .single()

    if (!horario) {
      return res.status(400).json({ error: 'El horario no existe' })
    }

    const { data: planServicio } = await supabaseAdmin
      .from('plan_servicios')
      .select('dias_por_semana')
      .eq('plan_id', usuario.plan_id)
      .eq('servicio_id', horario.servicio_id)
      .maybeSingle()

    if (!planServicio) {
      return res.status(400).json({ error: 'El plan de este socio no incluye el servicio de ese horario' })
    }

    if (planServicio.dias_por_semana !== null) {
      const { data: turnosFijosActivos } = await supabaseAdmin
        .from('turnos_fijos')
        .select('id, horario_id')
        .eq('usuario_id', usuario_id)
        .eq('activo', true)

      const idsHorariosDelSocio = (turnosFijosActivos || []).map((t) => t.horario_id)
      let cantidadDelServicio = 0

      if (idsHorariosDelSocio.length > 0) {
        const { data: horariosDelSocio } = await supabaseAdmin
          .from('horarios')
          .select('id, servicio_id')
          .in('id', idsHorariosDelSocio)

        cantidadDelServicio = (horariosDelSocio || []).filter((h) => h.servicio_id === horario.servicio_id).length
      }

      if (cantidadDelServicio >= planServicio.dias_por_semana) {
        return res.status(400).json({
          error: `Este socio ya tiene ${planServicio.dias_por_semana} turnos fijos de este servicio (el máximo de su plan)`,
        })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('turnos_fijos')
      .insert({ usuario_id, horario_id })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Este socio ya tiene ese turno fijo asignado' })
      }
      return res.status(500).json({ error: 'No se pudo asignar el turno fijo' })
    }

    // Generamos ya mismo las próximas reservas, para no depender de
    // que el socio entre a la app para que se le arme el calendario.
    await generarReservasDeTurnosFijos(usuario_id)

    return res.status(200).json({ turnoFijo: data })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) {
      return res.status(400).json({ error: 'Falta el id' })
    }

    const { error } = await supabaseAdmin.from('turnos_fijos').delete().eq('id', id)
    if (error) {
      return res.status(500).json({ error: 'No se pudo quitar el turno fijo' })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}