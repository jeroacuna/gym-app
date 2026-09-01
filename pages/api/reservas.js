import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (req.method === 'GET') {
    // Traemos las reservas activas del usuario, desde hoy en adelante,
    // con el detalle del horario (día y hora) para mostrarlo lindo.
    const hoy = new Date().toISOString().slice(0, 10)

    const { data: reservas, error } = await supabaseAdmin
      .from('reservas')
      .select('id, fecha, horarios(hora_inicio, hora_fin, dia_semana)')
      .eq('usuario_id', session.usuario.id)
      .eq('estado', 'activa')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })

    if (error) {
      return res.status(500).json({ error: 'Error al buscar tus reservas' })
    }

    return res.status(200).json({ reservas: reservas || [] })
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