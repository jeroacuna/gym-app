import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'
import { generarReservasDeTurnosFijos } from '../../lib/turnosFijos'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (req.method === 'GET') {
    // Antes de listar, nos aseguramos de que estén generadas las
    // reservas de las próximas semanas según los turnos fijos del
    // socio (si tiene). Así, con solo entrar al dashboard, ya le
    // aparece reservado su lugar de siempre sin que tenga que hacer
    // nada — el turno fijo "se materializa" solo.
    await generarReservasDeTurnosFijos(session.usuario.id)

    // Traemos las reservas activas del usuario, desde hoy en adelante,
    // con el detalle del horario (día y hora) para mostrarlo lindo.
    const hoy = new Date().toISOString().slice(0, 10)

    const { data: reservas, error } = await supabaseAdmin
      .from('reservas')
      .select('id, horario_id, fecha, horarios(hora_inicio, hora_fin, dia_semana, servicio_id)')
      .eq('usuario_id', session.usuario.id)
      .eq('estado', 'activa')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })

    if (error) {
      return res.status(500).json({ error: 'Error al buscar tus reservas' })
    }

    // Le sumamos el nombre del servicio (Gimnasio/Pilates) y si esa
    // reserva puntual viene de un turno fijo, para que el socio sepa
    // bien qué es cada cosa en su lista. Todo con consultas simples
    // (sin cruces automáticos anidados) para no depender del caché de
    // relaciones de Supabase.
    const idsServicios = [...new Set((reservas || []).map((r) => r.horarios?.servicio_id).filter(Boolean))]
    const { data: servicios } = idsServicios.length
      ? await supabaseAdmin.from('servicios').select('id, nombre').in('id', idsServicios)
      : { data: [] }
    const servicioPorId = {}
    ;(servicios || []).forEach((s) => { servicioPorId[s.id] = s.nombre })

    const { data: turnosFijos } = await supabaseAdmin
      .from('turnos_fijos')
      .select('horario_id')
      .eq('usuario_id', session.usuario.id)
      .eq('activo', true)
    const horariosFijos = new Set((turnosFijos || []).map((t) => t.horario_id))

    const reservasConDetalle = (reservas || []).map((r) => ({
      ...r,
      servicio_nombre: r.horarios?.servicio_id ? servicioPorId[r.horarios.servicio_id] || '' : '',
      es_fijo: horariosFijos.has(r.horario_id),
    }))

    return res.status(200).json({ reservas: reservasConDetalle })
  }

  if (req.method === 'POST') {
    const { horario_id, fecha } = req.body

    if (!horario_id || !fecha) {
      return res.status(400).json({ error: 'Faltan datos de la reserva' })
    }

    // Traemos el horario para saber a qué hora arranca, y así poder
    // decidir si "hoy a esa hora" ya pasó o no.
    const { data: horario, error: errorHorario } = await supabaseAdmin
      .from('horarios')
      .select('hora_inicio')
      .eq('id', horario_id)
      .single()

    if (errorHorario || !horario) {
      return res.status(404).json({ error: 'El horario no existe' })
    }

    const ahora = new Date()
    const hoyStr = ahora.toISOString().slice(0, 10)

    // Si mandan una fecha de un día que ya pasó por completo, no tiene
    // sentido ninguno intentar reservarla.
    if (fecha < hoyStr) {
      return res.status(400).json({ error: 'No se puede reservar una fecha que ya pasó' })
    }

    let fechaFinal = fecha
    let ajustada = false

    // Si la reserva es para HOY, pero el horario elegido ya arrancó,
    // interpretamos que el socio quiere ese mismo horario pero de la
    // semana que viene (es un gimnasio: "los lunes a las 14" siempre
    // tiene sentido, aunque hoy ya sean las 16).
    if (fecha === hoyStr) {
      const horarioDateTime = new Date(`${fecha}T${horario.hora_inicio}`)
      if (horarioDateTime <= ahora) {
        const fechaObj = new Date(`${fecha}T00:00:00`)
        fechaObj.setDate(fechaObj.getDate() + 7)
        fechaFinal = fechaObj.toISOString().slice(0, 10)
        ajustada = true
      }
    }

    // Llamamos a la función de Postgres que definimos en
    // sql/reservar_turno.sql. Ahí es donde se resuelve, de forma
    // segura, el chequeo de cupo + la inserción.
    const { data, error } = await supabaseAdmin.rpc('reservar_turno', {
      p_usuario_id: session.usuario.id,
      p_horario_id: horario_id,
      p_fecha: fechaFinal,
    })

    if (error) {
      return res.status(500).json({ error: 'Error al procesar la reserva' })
    }

    const resultado = data[0]
    if (!resultado.ok) {
      return res.status(409).json({ error: resultado.mensaje })
    }

    return res.status(200).json({
      ok: true,
      mensaje: resultado.mensaje,
      ajustada,
      fecha_final: fechaFinal,
    })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}