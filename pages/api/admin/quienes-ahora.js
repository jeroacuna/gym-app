import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabaseClient'
import { ahoraEnArgentina } from '../../../lib/fechaArgentina'

// Detecta automáticamente qué horario(s) están en curso AHORA MISMO
// (o, si no hay ninguno corriendo en este momento, cuál es el
// próximo de hoy), y devuelve la lista de socios anotados en cada
// uno. Así el admin no tiene que ir a buscar manualmente "quién
// viene a las 18" — lo ve solo con entrar a la pantalla de Rutinas.
export default async function handler(req, res) {
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario || session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { fecha, horaHHMMSS, diaSemana } = ahoraEnArgentina()

  const { data: horariosHoy, error } = await supabaseAdmin
    .from('horarios')
    .select('id, hora_inicio, hora_fin, servicio_id')
    .eq('dia_semana', diaSemana)
    .eq('activo', true)
    .order('hora_inicio', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Error al buscar horarios' })
  }

  const { data: servicios } = await supabaseAdmin.from('servicios').select('id, nombre')
  const servicioPorId = {}
  ;(servicios || []).forEach((s) => { servicioPorId[s.id] = s.nombre })

  // "En curso": la hora actual cae dentro de [hora_inicio, hora_fin).
  const enCurso = (horariosHoy || []).filter(
    (h) => h.hora_inicio <= horaHHMMSS && horaHHMMSS < h.hora_fin
  )

  let franjasBase = []
  let estado = 'en_curso'

  if (enCurso.length > 0) {
    franjasBase = enCurso
  } else {
    // Si no hay nada corriendo ahora mismo, mostramos el/los
    // próximos horarios de hoy (puede haber más de uno en paralelo,
    // ej: Gimnasio y Pilates arrancando juntos a las 18).
    const proximos = (horariosHoy || []).filter((h) => h.hora_inicio > horaHHMMSS)
    if (proximos.length > 0) {
      const primeraHora = proximos[0].hora_inicio
      franjasBase = proximos.filter((h) => h.hora_inicio === primeraHora)
      estado = 'proximo'
    }
  }

  if (franjasBase.length === 0) {
    return res.status(200).json({ franjas: [] })
  }

  const idsHorarios = franjasBase.map((h) => h.id)

  const { data: reservas } = await supabaseAdmin
    .from('reservas')
    .select('usuario_id, horario_id')
    .in('horario_id', idsHorarios)
    .eq('fecha', fecha)
    .eq('estado', 'activa')

  const idsUsuarios = [...new Set((reservas || []).map((r) => r.usuario_id))]

  const { data: usuarios } = idsUsuarios.length
    ? await supabaseAdmin.from('usuarios').select('id, nombre, apellido, dni').in('id', idsUsuarios)
    : { data: [] }

  const usuarioPorId = {}
  ;(usuarios || []).forEach((u) => { usuarioPorId[u.id] = u })

  // Diferencia en minutos entre dos horas HH:MM:SS, calculada como
  // texto plano (sin construir objetos Date) para no reintroducir
  // el mismo problema de huso horario que resolvimos arriba.
  function minutosHasta(horaObjetivoHHMMSS) {
    const [hh, mm] = horaObjetivoHHMMSS.split(':').map(Number)
    const [hhAhora, mmAhora] = horaHHMMSS.split(':').map(Number)
    return (hh * 60 + mm) - (hhAhora * 60 + mmAhora)
  }

  const franjas = franjasBase.map((h) => {
    const alumnosDeEsteHorario = (reservas || [])
      .filter((r) => r.horario_id === h.id)
      .map((r) => usuarioPorId[r.usuario_id])
      .filter(Boolean)
      .sort((a, b) => a.apellido.localeCompare(b.apellido))

    return {
      horario: {
        id: h.id,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        servicio_nombre: servicioPorId[h.servicio_id] || '',
        estado,
        minutos_para_empezar: estado === 'proximo' ? minutosHasta(h.hora_inicio) : null,
      },
      alumnos: alumnosDeEsteHorario,
    }
  })

  return res.status(200).json({ franjas })
}