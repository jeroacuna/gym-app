import { supabaseAdmin } from '../../lib/supabaseClient'

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

// Cuántas semanas para adelante buscamos si el día elegido no tiene
// nada libre, antes de rendirnos y decir "no hay nada disponible".
const SEMANAS_DE_BUSQUEDA = 8

function formatearFecha(fecha) {
  return fecha.toISOString().slice(0, 10)
}

// Dado un horario (que ya sabemos a qué día de la semana pertenece),
// arma la lista de sus próximas N fechas a partir de "desde" (sin
// incluir "desde" mismo, arrancamos al día siguiente).
function proximasFechasDelHorario(diaSemanaNumero, desdeISO, cantidad) {
  const desde = new Date(`${desdeISO}T00:00:00`)
  const fechas = []
  const cursor = new Date(desde)
  cursor.setDate(cursor.getDate() + 1) // arrancamos al día siguiente

  while (fechas.length < cantidad) {
    if (cursor.getDay() === diaSemanaNumero) {
      fechas.push(formatearFecha(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return fechas
}

// Si el día que pidió el socio no tiene ningún turno con lugar, esto
// busca hacia adelante (semana por semana) cuál es el primer turno de
// ESTE servicio que sí tiene un cupo libre.
async function buscarProximoDisponible(servicioId, fechaBase) {
  const { data: horariosDelServicio } = await supabaseAdmin
    .from('horarios')
    .select('id, dia_semana, hora_inicio, hora_fin, capacidad_maxima')
    .eq('servicio_id', servicioId)
    .eq('activo', true)

  if (!horariosDelServicio || horariosDelServicio.length === 0) return null

  // Armamos todos los candidatos (horario + fecha futura) y los
  // ordenamos por fecha y hora, para revisarlos en orden cronológico.
  const candidatos = []
  horariosDelServicio.forEach((h) => {
    const diaNumero = DIAS.indexOf(h.dia_semana)
    if (diaNumero === -1) return
    const fechas = proximasFechasDelHorario(diaNumero, fechaBase, SEMANAS_DE_BUSQUEDA)
    fechas.forEach((fecha) => {
      candidatos.push({ ...h, fecha })
    })
  })

  candidatos.sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))

  const fechasCandidatas = [...new Set(candidatos.map((c) => c.fecha))]
  const idsHorarios = horariosDelServicio.map((h) => h.id)

  const { data: reservas } = await supabaseAdmin
    .from('reservas')
    .select('horario_id, fecha')
    .in('horario_id', idsHorarios)
    .in('fecha', fechasCandidatas)
    .eq('estado', 'activa')

  const ocupadosPorClave = {}
  ;(reservas || []).forEach((r) => {
    const clave = `${r.horario_id}|${r.fecha}`
    ocupadosPorClave[clave] = (ocupadosPorClave[clave] || 0) + 1
  })

  for (const c of candidatos) {
    const ocupados = ocupadosPorClave[`${c.id}|${c.fecha}`] || 0
    if (ocupados < c.capacidad_maxima) {
      return {
        horario_id: c.id,
        fecha: c.fecha,
        hora_inicio: c.hora_inicio,
        hora_fin: c.hora_fin,
      }
    }
  }

  return null // no encontramos lugar en las próximas semanas
}

export default async function handler(req, res) {
  const { fecha, servicio_id } = req.query

  if (!fecha) {
    return res.status(400).json({ error: 'Falta la fecha' })
  }

  if (!servicio_id) {
    return res.status(400).json({ error: 'Falta el servicio (gimnasio o pilates)' })
  }

  // OJO con esto: parseamos agregando "T00:00:00" para que JavaScript
  // interprete la fecha en horario local y no nos corra un día para
  // atrás por husos horarios (un bug clásico y molesto).
  const fechaObj = new Date(`${fecha}T00:00:00`)
  const diaSemana = DIAS[fechaObj.getDay()]

  const { data: horarios, error } = await supabaseAdmin
    .from('horarios')
    .select('id, hora_inicio, hora_fin, capacidad_maxima')
    .eq('dia_semana', diaSemana)
    .eq('servicio_id', servicio_id)
    .eq('activo', true)
    .order('hora_inicio', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar horarios' })
  }

  const { data: reservasDelDia } = await supabaseAdmin
    .from('reservas')
    .select('horario_id')
    .eq('fecha', fecha)
    .eq('estado', 'activa')

  const ocupadosPorHorario = {}
  ;(reservasDelDia || []).forEach((r) => {
    ocupadosPorHorario[r.horario_id] = (ocupadosPorHorario[r.horario_id] || 0) + 1
  })

  const resultado = (horarios || []).map((h) => {
    const ocupados = ocupadosPorHorario[h.id] || 0
    return {
      id: h.id,
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      capacidad_maxima: h.capacidad_maxima,
      ocupados,
      disponible: ocupados < h.capacidad_maxima,
    }
  })

  // Si ninguno de los turnos de ese día tiene lugar (o directamente no
  // hay turnos ese día), buscamos el próximo que sí tenga cupo.
  const hayLugarEseDia = resultado.some((h) => h.disponible)
  let proximoDisponible = null
  if (!hayLugarEseDia) {
    proximoDisponible = await buscarProximoDisponible(servicio_id, fecha)
  }

  return res.status(200).json({ fecha, dia_semana: diaSemana, horarios: resultado, proximoDisponible })
}