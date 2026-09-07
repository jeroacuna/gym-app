// Hablamos directo con la API REST de Mercado Pago (sin el SDK) para
// mantenerlo simple y transparente. Necesita la variable de entorno
// MERCADOPAGO_ACCESS_TOKEN (el "Access Token" de tu cuenta, de
// producción o de prueba, según lo que estés usando).

const BASE_URL = 'https://api.mercadopago.com'

// Crea una preferencia de pago para la cuota de un socio en un mes
// puntual. Devuelve la URL (init_point) a la que hay que mandar al
// socio para que pague.
export async function crearPreferenciaCuota({ usuarioId, nombreSocio, mes, anio, monto, baseUrl }) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('Falta configurar MERCADOPAGO_ACCESS_TOKEN')
  }

  // Guardamos acá los 3 datos que necesitamos para saber, cuando
  // llegue el webhook, a qué socio y qué mes corresponde este pago.
  const referenciaExterna = `${usuarioId}|${mes}|${anio}`

  const respuesta = await fetch(`${BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      items: [
        {
          id: 'cuota-mensual',
          title: `Cuota ${mes}/${anio} - ${nombreSocio}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: Number(monto),
        },
      ],
      external_reference: referenciaExterna,
      notification_url: `${baseUrl}/api/pagos/webhook`,
      back_urls: {
        success: `${baseUrl}/dashboard?pago=exito`,
        pending: `${baseUrl}/dashboard?pago=pendiente`,
        failure: `${baseUrl}/dashboard?pago=fallido`,
      },
      auto_return: 'approved',
    }),
  })

  const data = await respuesta.json()

  if (!respuesta.ok) {
    console.error('Error creando preferencia de Mercado Pago:', data)
    throw new Error(data.message || 'No se pudo crear el link de pago')
  }

  return data.init_point
}

// Consulta el estado real de un pago en Mercado Pago (NUNCA confiamos
// ciegamente en lo que dice el webhook — siempre volvemos a preguntar
// directo a la API para confirmar que el pago existe y está aprobado).
export async function consultarPago(paymentId) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

  const respuesta = await fetch(`${BASE_URL}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!respuesta.ok) {
    throw new Error(`No se pudo consultar el pago ${paymentId}`)
  }

  return respuesta.json()
}