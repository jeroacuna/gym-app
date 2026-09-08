import { getIronSession } from 'iron-session'
import { sessionOptions } from '../../lib/session'
import { supabaseAdmin } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  // 1. Obtenemos la sesión del usuario logueado para saber quién está pidiendo la rutina
  const session = await getIronSession(req, res, sessionOptions)
  if (!session.usuario) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const usuarioId = session.usuario.id

  // 2. MODO GET: Cargar la rutina y los ejercicios del socio
  if (req.method === 'GET') {
    try {
      // Buscamos si el usuario tiene una rutina asignada (asumiendo una tabla "rutinas" vinculada por usuario_id)
      const { data: rutinaData, error: errorRutina } = await supabaseAdmin
        .from('rutinas')
        .select('*')
        .eq('usuario_id', usuarioId)
        .single()

      // Si no tiene rutina asignada, devolvemos objetos vacíos controlados
      if (errorRutina || !rutinaData) {
        return res.status(200).json({ rutina: null, ejercicios: [] })
      }

      // Buscamos los ejercicios asociados a esta rutina en la tabla "ejercicios"
      const { data: ejerciciosData, error: errorEjercicios } = await supabaseAdmin
        .from('ejercicios')
        .select('*')
        .eq('rutina_id', rutinaData.id)

      if (errorEjercicios) {
        console.error('Error al obtener ejercicios:', errorEjercicios)
        return res.status(500).json({ error: 'No se pudieron cargar los ejercicios' })
      }

      return res.status(200).json({ 
        rutina: rutinaData, 
        ejercicios: ejerciciosData || [] 
      })

    } catch (err) {
      console.error('Error interno al obtener la rutina:', err)
      return res.status(500).json({ error: 'Error interno del servidor' })
    }
  }

  // 3. MODO PUT: Actualizar pesos o repeticiones de un ejercicio específico
  if (req.method === 'PUT') {
    try {
      const { ejercicioId, peso, repeticiones } = req.body

      if (!ejercicioId) {
        return res.status(400).json({ error: 'Falta el ID del ejercicio' })
      }

      const { data, error } = await supabaseAdmin
        .from('ejercicios')
        .update({ 
          peso_sugerido: peso, 
          repeticiones: repeticiones 
        })
        .eq('id', ejercicioId)
        .select()

      if (error) {
        console.error('Error al actualizar en Supabase:', error)
        return res.status(500).json({ error: 'No se pudo actualizar el ejercicio' })
      }

      return res.status(200).json({ ok: true, ejercicio: data[0] })

    } catch (err) {
      console.error('Error interno en el servidor:', err)
      return res.status(500).json({ error: 'Error interno del servidor' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT'])
  return res.status(405).end(`Método ${req.method} No Permitido`)
}