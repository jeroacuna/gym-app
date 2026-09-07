import { supabaseAdmin } from '../../lib/supabaseClient'

export default async function handler(req, res) {
  // Solo permitimos peticiones de tipo PUT para actualizar registros
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const { ejercicioId, peso, repeticiones } = req.body

    if (!ejercicioId) {
      return res.status(400).json({ error: 'Falta el ID del ejercicio' })
    }

    // Actualizamos los valores en la tabla de ejercicios de la rutina
    const { data, error } = await supabaseAdmin
      .from('ejercicios_rutina') // Ajusta el nombre de tu tabla si difiere levemente
      .update({ 
        peso: peso, 
        repeticiones: repeticiones 
      })
      .eq('id', ejercicioId)
      .select()

    if (error) {
      console.error('Error al actualizar rutina en Supabase:', error)
      return res.status(500).json({ error: 'No se pudo actualizar el ejercicio' })
    }

    return res.status(200).json({ ok: true, ejercicio: data[0] })

  } catch (err) {
    console.error('Error en el servidor al actualizar rutina:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}