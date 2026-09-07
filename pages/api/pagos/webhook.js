import { supabaseAdmin } from '../../../lib/supabaseClient'
import { consultarPago } from '../../../lib/mercadopago'

// Mercado Pago llama a esta URL solo, cada vez que un pago cambia de
// estado (se crea, se aprueba, se rechaza, etc). Nosotros no le
// creemos nada a lo que nos manda en el body — apenas nos dice "che,
// pasó algo con el pago X", volvemos a preguntarle a la API real de
// Mercado Pago cuál es el estado verdadero de ese pago, y recién ahí
// actualizamos nuestra base. Esto evita que alguien nos pueda mandar
// un webhook falso diciendo "ya pagué" sin haber pagado.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  // Mercado Pago manda el id del pago de dos formas posibles según el
  // tipo de notificación: en el body (nuevo formato) o en la query
  // (formato viejo, todavía en uso). Buscamos en los dos lugares.
  const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id

  if (!paymentId) {
    // No es una notificación de pago (puede ser de otro tipo de
    // evento que no nos interesa). Respondemos 200 igual para que
    // Mercado Pago no siga reintentando.
    return res.status(200).json({ ok: true })
  }

  try {
    const pago = await consultarPago(paymentId)

    if (pago.status !== 'approved') {
      // Pendiente, rechazado, etc. Todavía no hay nada que marcar.
      return res.status(200).json({ ok: true })
    }

    const [usuarioId, mes, anio] = (pago.external_reference || '').split('|')
    if (!usuarioId || !mes || !anio) {
      console.error('Webhook de Mercado Pago sin external_reference válido:', pago.external_reference)
      return res.status(200).json({ ok: true })
    }

    // "upsert" sobre la restricción única (usuario_id, mes, anio): si
    // ya existía la fila del mes (por ejemplo el admin la había
    // cargado a mano antes), la actualiza; si no existía, la crea.
    const { error } = await supabaseAdmin.from('pagos').upsert(
      {
        usuario_id: usuarioId,
        mes: Number(mes),
        anio: Number(anio),
        estado: 'pagado',
        monto: pago.transaction_amount,
        fecha_pago: new Date().toISOString(),
        mp_payment_id: String(pago.id),
      },
      { onConflict: 'usuario_id,mes,anio' }
    )

    if (error) {
      console.error('Error al guardar el pago confirmado:', error)
      return res.status(500).json({ error: 'No se pudo guardar el pago' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Error procesando webhook de Mercado Pago:', err)
    // Igual respondemos 200: si le devolvemos error, Mercado Pago va
    // a reintentar el mismo webhook muchas veces seguidas.
    return res.status(200).json({ ok: true })
  }
}